import { TILE, COLS, ROWS, VIEW_W, VIEW_H } from '../config.js' 
import { TILES, TILE_BY_CODE, TILE_HINTS, EMPTY, drawTile } from '../tiles.js' 
import { ZONES, zoneById } from '../zones.js' 
import {
  ENTITY_TYPES,
  blankLevel,
  normaliseLevel,
  cloneLevel,
  getTile,
  setTile,
  inBounds,
  validateLevel,
} from '../level.js' 
import {
  loadProject,
  saveProject,
  resetProject,
  normaliseProject,
  downloadJSON,
  pickJSONFile,
} from '../storage.js' 
import {
  drawBackdrop,
  drawTiles,
  drawEntity,
  drawGrid,
  drawRelic,
  drawExit,
  createWeather,
  updateWeather,
  drawWeatherBack,
  drawWeatherFront,
} from '../render.js' 
import { drawSprite } from '../sprites.js' 

const $ = (id) => document.getElementById(id) 
const MAX_UNDO = 100 

export class Editor {
  constructor({ sprites, onPlay }) {
    this.sprites = sprites 
    this.onPlay = onPlay 
    this.project = loadProject() 
    this.zoneId = ZONES[0].id 
    this.levelIndex = 0 
    this.selection = { kind: 'tile', code: 'g' } 
    this.tool = 'brush' 
    this.showGrid = true 
    this.storm = true 
    this.weather = createWeather(3) 
    this.hover = null 
    this.drag = null  
    this.undoStack = [] 
    this.redoStack = [] 
    this.saveTimer = null 

    this.buildPalette() 
    this.bindUI() 
    this.refreshZoneList() 
    this.refreshLevelList() 
    this.refreshSidebar() 
  }

  get zone() {
    return zoneById(this.zoneId) 
  }
  get levels() {
    return this.project.zones[this.zoneId] 
  }
  get level() {
    return this.levels[this.levelIndex] 
  }

  buildPalette() {
    const host = $('palette') 
    host.innerHTML = '' 
    const section = (title) => {
      const h = document.createElement('h2') 
      h.textContent = title 
      const grid = document.createElement('div') 
      grid.className = 'swatches' 
      host.append(h, grid) 
      return grid 
    } 

    const groups = {} 
    TILES.forEach((t, i) => {
      groups[t.category] ??= section(t.category) 
      const key = i < 9 ? String(i + 1) : i === 9 ? '0' : '' 
      const cv = this.swatchCanvas(24, 24, (g) => {
        drawTile(
          g,
          t.code,
          4,
          t.code === 'T' ? 8 : 4,
          {
            up: EMPTY,
            down: t.code === 'T' ? EMPTY : t.code,
            left: EMPTY,
            right: EMPTY,
          },
          1,
          1,
          0,
        ) 
      }) 
      groups[t.category].append(
        this.swatchButton(
          cv,
          t.name,
          { kind: 'tile', code: t.code },
          key,
          TILE_HINTS[t.behaviour],
        ),
      ) 
    }) 

    const ents = section('Entities') 
    for (const et of ENTITY_TYPES) {
      const cv = this.swatchCanvas(32, 36, (g) => {
        if (et.type === 'spawn')
          drawSprite(g, this.sprites.sally, 'idle', 0, 16, 34) 
        if (et.type === 'skeleton')
          drawSprite(g, this.sprites.skeleton, 'walk', 0, 16, 34) 
        if (et.type === 'relic') drawRelic(g, 0.5, 1, 0) 
        if (et.type === 'exit') drawExit(g, 0, 1.25, this.zone, true, 0) 
      }) 
      ents.append(
        this.swatchButton(
          cv,
          et.name,
          { kind: 'entity', type: et.type },
          '',
          et.hint,
          true,
        ),
      ) 
    }

    const misc = section('Other') 
    const eraser = this.swatchCanvas(24, 24, (g) => {
      g.strokeStyle = '#e05a4a' 
      g.lineWidth = 2 
      g.strokeRect(5, 5, 14, 14) 
      g.beginPath() 
      g.moveTo(5, 5) 
      g.lineTo(19, 19) 
      g.stroke() 
    }) 
    misc.append(
      this.swatchButton(
        eraser,
        'Eraser',
        { kind: 'erase' },
        'E',
        'Or just right-click',
      ),
    ) 
    this.highlightSelection() 
  }

  swatchCanvas(w, h, paint) {
    const cv = document.createElement('canvas') 
    cv.width = w 
    cv.height = h 
    const g = cv.getContext('2d') 
    g.imageSmoothingEnabled = false 
    paint(g) 
    return cv 
  }

  swatchButton(cv, label, selection, key, hint, wide = false) {
    const b = document.createElement('button') 
    b.className = 'swatch' + (wide ? ' wide' : '') 
    b.title = hint || label 
    b.dataset.sel = JSON.stringify(selection) 
    if (key) {
      const k = document.createElement('span') 
      k.className = 'key' 
      k.textContent = key 
      b.append(k) 
    }
    const name = document.createElement('span') 
    name.textContent = label 
    b.append(cv, name) 
    b.addEventListener('click', () => this.select(selection)) 
    return b 
  }

  select(selection) {
    this.selection = selection 
    this.highlightSelection() 
  }

  highlightSelection() {
    const cur = JSON.stringify(this.selection) 
    document
      .querySelectorAll('.swatch')
      .forEach((b) => b.classList.toggle('active', b.dataset.sel === cur)) 
    document
      .querySelectorAll('#tools button')
      .forEach((b) =>
        b.classList.toggle('active', b.dataset.tool === this.tool),
      ) 
  }

  bindUI() {
    $('zoneSelect').addEventListener('change', (e) => {
      this.zoneId = e.target.value 
      this.levelIndex = 0 
      this.afterLevelSwitch() 
      this.buildPalette()  
    }) 
    $('levelSelect').addEventListener('change', (e) => {
      this.levelIndex = Number(e.target.value) 
      this.afterLevelSwitch() 
    }) 
    $('btnNew').addEventListener('click', () => {
      this.levels.push(
        blankLevel(`${this.zone.name} ${this.levels.length + 1}`),
      ) 
      this.levelIndex = this.levels.length - 1 
      this.afterLevelSwitch(true) 
    }) 
    $('btnDuplicate').addEventListener('click', () => {
      const copy = cloneLevel(this.level) 
      copy.name += ' (copy)' 
      this.levels.splice(this.levelIndex + 1, 0, copy) 
      this.levelIndex++ 
      this.afterLevelSwitch(true) 
    }) 
    $('btnDelete').addEventListener('click', () => {
      if (!confirm(`Delete '${this.level.name}'? This can't be undone.`))
        return 
      this.levels.splice(this.levelIndex, 1) 
      if (!this.levels.length)
        this.levels.push(blankLevel(`${this.zone.name} 1`)) 
      this.levelIndex = Math.min(this.levelIndex, this.levels.length - 1) 
      this.afterLevelSwitch(true) 
    }) 
    $('btnUp').addEventListener('click', () => this.moveLevel(-1)) 
    $('btnDown').addEventListener('click', () => this.moveLevel(1)) 
    $('btnPlay').addEventListener('click', () => this.play()) 

    $('levelName').addEventListener('input', (e) => {
      this.level.name = e.target.value || 'Untitled' 
      this.refreshLevelList() 
      this.changed() 
    }) 
    document.querySelectorAll('#tools button').forEach((b) =>
      b.addEventListener('click', () => {
        this.tool = b.dataset.tool 
        this.highlightSelection() 
      }),
    ) 
    $('gridToggle').addEventListener('change', (e) => {
      this.showGrid = e.target.checked 
    }) 
    $('stormToggle').addEventListener('change', (e) => {
      this.storm = e.target.checked 
    }) 

    $('btnExportProject').addEventListener('click', () =>
      downloadJSON(this.project, 'myth-levels.json'),
    ) 
    $('btnImportProject').addEventListener('click', async () => {
      try {
        const data = await pickJSONFile() 
        if (!confirm('Replace ALL zones and levels with the imported file?'))
          return 
        this.project = normaliseProject(data) 
        this.levelIndex = 0 
        this.afterLevelSwitch(true) 
      } catch (err) {
        alert(`Couldn't import: ${err.message}`) 
      }
    }) 
    $('btnExportLevel').addEventListener('click', () => {
      const slug = this.level.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') 
      downloadJSON(this.level, `myth-${this.zoneId}-${slug}.json`) 
    }) 
    $('btnImportLevel').addEventListener('click', async () => {
      try {
        const data = await pickJSONFile() 
        this.pushUndo() 
        this.levels[this.levelIndex] = normaliseLevel(data) 
        this.afterLevelSwitch(true, true) 
      } catch (err) {
        alert(`Couldn't import: ${err.message}`) 
      }
    }) 
    $('btnClear').addEventListener('click', () => {
      if (!confirm('Clear every tile and entity from this level?')) return 
      this.pushUndo() 
      const fresh = blankLevel(this.level.name) 
      this.levels[this.levelIndex] = fresh 
      this.changed() 
    }) 
    $('btnReset').addEventListener('click', () => {
      if (!confirm('Discard ALL local levels and reload the starter project?'))
        return 
      this.project = resetProject() 
      this.levelIndex = 0 
      this.afterLevelSwitch(true) 
    }) 
  }

  bindCanvas(canvas) {
    this.canvas = canvas 
    canvas.addEventListener('contextmenu', (e) => e.preventDefault()) 
    canvas.addEventListener('mousedown', (e) => this.mouseDown(e)) 
    window.addEventListener('mousemove', (e) => this.mouseMove(e)) 
    window.addEventListener('mouseup', (e) => this.mouseUp(e)) 
    canvas.addEventListener('mouseleave', () => {
      this.hover = null 
      this.updateStatus() 
    }) 
  }

  moveLevel(delta) {
    const j = this.levelIndex + delta 
    if (j < 0 || j >= this.levels.length) return 
    const [lvl] = this.levels.splice(this.levelIndex, 1) 
    this.levels.splice(j, 0, lvl) 
    this.levelIndex = j 
    this.refreshLevelList() 
    this.changed() 
  }

  afterLevelSwitch(save = false, keepUndo = false) {
    if (!keepUndo) {
      this.undoStack = [] 
      this.redoStack = [] 
    }
    this.refreshLevelList() 
    this.refreshSidebar() 
    if (save) this.changed() 
  }

  refreshZoneList() {
    $('zoneSelect').innerHTML = ZONES.map(
      (z) => `<option value='${z.id}'>${z.name}</option>`,
    ).join('') 
    $('zoneSelect').value = this.zoneId 
  }

  refreshLevelList() {
    $('levelSelect').innerHTML = this.levels
      .map(
        (l, i) =>
          `<option value='${i}'>${i + 1}. ${escapeHtml(l.name)}</option>`,
      )
      .join('') 
    $('levelSelect').value = String(this.levelIndex) 
  }

  refreshSidebar() {
    if (document.activeElement !== $('levelName'))
      $('levelName').value = this.level.name 
    const problems = validateLevel(this.level) 
    const relics = this.level.entities.filter((e) => e.type === 'relic').length 
    const skels = this.level.entities.filter(
      (e) => e.type === 'skeleton',
    ).length 
    $('checks').innerHTML = [
      ...problems.map((p) => `<li class='warn'>⚠ ${p}</li>`),
      `<li class='ok'>Relics: ${relics} · Skeletons: ${skels}</li>`,
    ].join('') 
  }

  changed() {
    this.refreshSidebar() 
    $('saveState').textContent = 'Saving…' 
    $('saveState').classList.add('dirty') 
    clearTimeout(this.saveTimer) 
    this.saveTimer = setTimeout(() => {
      const ok = saveProject(this.project) 
      $('saveState').textContent = ok ? 'Saved' : 'Save failed!' 
      $('saveState').classList.toggle('dirty', !ok) 
    }, 300) 
  }

  pushUndo(snapshot = JSON.stringify(this.level)) {
    this.undoStack.push(snapshot) 
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift() 
    this.redoStack = [] 
  }

  undo() {
    if (!this.undoStack.length) return 
    this.redoStack.push(JSON.stringify(this.level)) 
    this.levels[this.levelIndex] = JSON.parse(this.undoStack.pop()) 
    this.refreshLevelList() 
    this.changed() 
  }

  redo() {
    if (!this.redoStack.length) return 
    this.undoStack.push(JSON.stringify(this.level)) 
    this.levels[this.levelIndex] = JSON.parse(this.redoStack.pop()) 
    this.refreshLevelList() 
    this.changed() 
  }

  cellFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect() 
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W 
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H 
    return {
      c: Math.floor(x / TILE),
      r: Math.floor(y / TILE),
      inside: x >= 0 && y >= 0 && x < VIEW_W && y < VIEW_H,
    } 
  }

  mouseDown(e) {
    const cell = this.cellFromEvent(e) 
    if (!cell.inside) return 
    e.preventDefault() 

    if (e.altKey || e.button === 1) {
      // eyedropper
      const code = getTile(this.level, cell.c, cell.r) 
      if (code !== EMPTY) this.select({ kind: 'tile', code }) 
      return 
    }

    const erase = e.button === 2 || this.selection.kind === 'erase' 
    this.drag = { erase, start: cell, before: JSON.stringify(this.level) } 

    if (!erase && this.selection.kind === 'entity') {
      this.placeEntity(cell.c, cell.r) 
      this.drag.done = true 
    } else if (this.tool === 'fill') {
      this.floodFill(cell.c, cell.r, erase ? EMPTY : this.selection.code) 
      this.drag.done = true 
    } else if (this.tool === 'brush') {
      this.paint(cell.c, cell.r, erase) 
    }
  }

  mouseMove(e) {
    if (!this.canvas) return 
    const cell = this.cellFromEvent(e) 
    this.hover = cell.inside ? cell : null 
    if (this.drag && !this.drag.done && this.tool === 'brush' && cell.inside) {
      this.paint(cell.c, cell.r, this.drag.erase) 
    }
    this.updateStatus() 
  }

  mouseUp(e) {
    if (!this.drag) return 
    if (!this.drag.done && this.tool === 'rect') {
      const end = this.hover ?? this.drag.start 
      this.fillRect(this.drag.start, end, this.drag.erase) 
    }
    const after = JSON.stringify(this.level) 
    if (after !== this.drag.before) {
      this.pushUndo(this.drag.before) 
      this.changed() 
    }
    this.drag = null 
    this.updateStatus() 
  }

  paint(c, r, erase) {
    if (erase) {
      const idx = this.entityIndexAt(c, r) 
      if (idx >= 0) this.level.entities.splice(idx, 1) 
      else setTile(this.level, c, r, EMPTY) 
    } else if (this.selection.kind === 'tile') {
      setTile(this.level, c, r, this.selection.code) 
    }
  }

  fillRect(a, b, erase) {
    const c0 = Math.max(0, Math.min(a.c, b.c)),
      c1 = Math.min(COLS - 1, Math.max(a.c, b.c)) 
    const r0 = Math.max(0, Math.min(a.r, b.r)),
      r1 = Math.min(ROWS - 1, Math.max(a.r, b.r)) 
    const code = erase
      ? EMPTY
      : this.selection.kind === 'tile'
        ? this.selection.code
        : null 
    if (code === null) return 
    for (let r = r0; r <= r1;  r++)
      for (let c = c0; c <= c1;  c++) setTile(this.level, c, r, code) 
    if (erase) {
      this.level.entities = this.level.entities.filter(
        (en) => !(en.c >= c0 && en.c <= c1 && en.r >= r0 && en.r <= r1),
      ) 
    }
  }

  floodFill(c, r, code) {
    if (code === undefined) return 
    const target = getTile(this.level, c, r) 
    if (target === code) return 
    const stack = [[c, r]] 
    while (stack.length) {
      const [x, y] = stack.pop() 
      if (!inBounds(x, y) || getTile(this.level, x, y) !== target) continue 
      setTile(this.level, x, y, code) 
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]) 
    }
  }

  footprint(en) {
    switch (en.type) {
      case 'exit':
        return { c0: en.c, c1: en.c + 1, r0: en.r - 1, r1: en.r } 
      case 'relic':
        return { c0: en.c, c1: en.c, r0: en.r, r1: en.r } 
      default:
        return { c0: en.c, c1: en.c, r0: en.r - 1, r1: en.r } 
    }
  }

  entityIndexAt(c, r) {
    for (let i = this.level.entities.length - 1; i >= 0;  i--) {
      const f = this.footprint(this.level.entities[i]) 
      if (c >= f.c0 && c <= f.c1 && r >= f.r0 && r <= f.r1) return i 
    }
    return -1 
  }

  placeEntity(c, r) {
    const type = this.selection.type 
    const def = ENTITY_TYPES.find((t) => t.type === type) 
    const ents = this.level.entities 
    const existing = ents.find(
      (en) => en.type === type && en.c === c && en.r === r,
    ) 
    if (existing) {
      if (type === 'skeleton') existing.dir = -(existing.dir ?? 1)  // flip patrol direction
      return 
    }
    if (def.unique) this.level.entities = ents.filter((en) => en.type !== type) 
    const en = { type, c, r } 
    if (type === 'skeleton') en.dir = 1 
    if (type === 'exit') en.c = Math.min(c, COLS - 2) 
    this.level.entities.push(en) 
  }

  keyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return 
    const ctrl = e.ctrlKey || e.metaKey 
    if (ctrl && e.code === 'KeyZ') {
      e.preventDefault() 
      e.shiftKey ? this.redo() : this.undo() 
      return 
    }
    if (ctrl && e.code === 'KeyY') {
      e.preventDefault() 
      this.redo() 
      return 
    }
    if (ctrl) return 

    const digit = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : null 
    if (digit !== null) {
      const t = TILES[digit === 0 ? 9 : digit - 1] 
      if (t) this.select({ kind: 'tile', code: t.code }) 
      return 
    }
    switch (e.code) {
      case 'KeyB':
        this.tool = 'brush' 
        this.highlightSelection() 
        break 
      case 'KeyR':
        this.tool = 'rect' 
        this.highlightSelection() 
        break 
      case 'KeyF':
        this.tool = 'fill' 
        this.highlightSelection() 
        break 
      case 'KeyE':
        this.select({ kind: 'erase' }) 
        break 
      case 'KeyG':
        this.showGrid = !this.showGrid 
        $('gridToggle').checked = this.showGrid 
        break 
      case 'KeyP':
        this.play() 
        break 
    }
  }

  play() {
    const problems = validateLevel(this.level).filter(
      (p) => !p.startsWith('No relics'),
    ) 
    if (problems.length) {
      alert(problems.join('\n')) 
      return 
    }
    this.onPlay(this.level, this.zone) 
  }

  updateStatus() {
    const bar = $('statusbar') 
    if (!this.hover) {
      bar.innerHTML = '&nbsp ' 
      return 
    }
    const { c, r } = this.hover 
    const parts = [`Cell ${c}, ${r}`] 
    const idx = this.entityIndexAt(c, r) 
    if (idx >= 0) {
      const en = this.level.entities[idx] 
      const def = ENTITY_TYPES.find((t) => t.type === en.type) 
      parts.push(
        def.name +
          (en.type === 'skeleton'
            ? en.dir < 0
              ? ' (facing left)'
              : ' (facing right)'
            : ''),
      ) 
    }
    const code = getTile(this.level, c, r) 
    const t = TILE_BY_CODE[code] 
    if (t) parts.push(`${t.name} — ${TILE_HINTS[t.behaviour]}`) 
    bar.textContent = parts.join('  ·  ') 
  }

  tick() {
    if (this.storm) updateWeather(this.weather) 
  }

  draw(ctx, frame) {
    drawBackdrop(ctx, this.zone) 
    if (this.storm) drawWeatherBack(ctx, this.weather) 
    drawTiles(ctx, this.level, frame) 
    for (const en of this.level.entities)
      drawEntity(ctx, en, this.zone, this.sprites, frame) 
    if (this.storm) drawWeatherFront(ctx, this.weather) 
    if (this.showGrid) drawGrid(ctx) 
    this.drawCursor(ctx, frame) 
  }

  drawCursor(ctx, frame) {
    if (!this.hover) return 
    const { c, r } = this.hover 
    const erase =
      (this.drag && this.drag.erase) || this.selection.kind === 'erase' 

    if (this.drag && this.tool === 'rect' && !this.drag.done) {
      const a = this.drag.start 
      const x0 = Math.min(a.c, c) * TILE,
        y0 = Math.min(a.r, r) * TILE 
      const w = (Math.abs(a.c - c) + 1) * TILE,
        h = (Math.abs(a.r - r) + 1) * TILE 
      ctx.fillStyle = erase ? 'rgba(224,90,74,0.25)' : 'rgba(240,192,64,0.2)' 
      ctx.fillRect(x0, y0, w, h) 
      ctx.strokeStyle = erase ? '#e05a4a' : '#f0c040' 
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1) 
      return 
    }

    if (!erase) {
      ctx.globalAlpha = 0.6 
      if (this.selection.kind === 'tile') {
        drawTile(
          ctx,
          this.selection.code,
          c * TILE,
          r * TILE,
          { up: EMPTY, down: EMPTY, left: EMPTY, right: EMPTY },
          c,
          r,
          frame,
        ) 
      } else if (this.selection.kind === 'entity') {
        drawEntity(
          ctx,
          {
            type: this.selection.type,
            c: this.selection.type === 'exit' ? Math.min(c, COLS - 2) : c,
            r,
            dir: 1,
          },
          this.zone,
          this.sprites,
          frame,
        ) 
      }
      ctx.globalAlpha = 1 
    }
    ctx.strokeStyle = erase ? '#e05a4a' : 'rgba(255,255,255,0.8)' 
    ctx.lineWidth = 1 
    ctx.strokeRect(c * TILE + 0.5, r * TILE + 0.5, TILE - 1, TILE - 1) 
  }
}

function escapeHtml(s) {
  return s.replace(
    /[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])
  )
}
