import {
  TILE,
  COLS,
  ROWS,
  VIEW_W,
  VIEW_H,
  HUD_H,
  PHYSICS,
  HERO_BOX,
  SKELETON_BOX,
  SKELETON_SPEED,
} from '../config.js'
import { TILE_BY_CODE, EMPTY } from '../tiles.js'
import {
  drawBackdrop,
  drawTiles,
  drawExit,
  drawRelic,
  createWeather,
  updateWeather,
  drawWeatherBack,
  drawWeatherFront,
} from '../render.js'
import { unlockAudio, thunder } from '../audio.js'
import { drawSprite, frameAt } from '../sprites.js'
import { cloneLevel } from '../level.js'

const KEYS = {
  left: ['ArrowLeft', 'KeyO'],
  right: ['ArrowRight', 'KeyP'],
  up: ['ArrowUp', 'KeyQ'],
  down: ['ArrowDown', 'KeyA'],
  jump: ['Space'],
}

export class Game {
  constructor(level, zone, sprites, { onExit }) {
    this.source = cloneLevel(level)
    this.zone = zone
    this.sprites = sprites
    this.onExit = onExit
    this.held = new Set()
    this.deaths = 0
    this.frame = 0
    this.weather = createWeather(7)
    unlockAudio()
    this.reset()
  }

  reset() {
    const lvl = cloneLevel(this.source)
    this.tiles = lvl.tiles
    this.crumble = new Map()
    const spawn = lvl.entities.find((e) => e.type === 'spawn') ?? {
      c: 2,
      r: ROWS - 2,
    }
    this.hero = {
      x: spawn.c * TILE + TILE / 2,
      y: (spawn.r + 1) * TILE,
      dir: 1,
      state: 'ground',
      vy: 0,
      jumpDir: 0,
      peakY: 0,
      airT: 0,
      t: 0,
      moving: false,
    }
    this.relics = lvl.entities
      .filter((e) => e.type === 'relic')
      .map((e) => ({ ...e, got: false }))
    this.exit = lvl.entities.find((e) => e.type === 'exit') ?? null
    this.skeletons = lvl.entities
      .filter((e) => e.type === 'skeleton')
      .map((e) => ({
        x: e.c * TILE + TILE / 2,
        y: (e.r + 1) * TILE,
        dir: e.dir ?? 1,
        vy: 0,
        t: 0,
      }))
    this.status = 'playing'
    this.timer = 0
  }

  get exitOpen() {
    return this.relics.every((r) => r.got)
  }

  keyDown(e) {
    unlockAudio()
    if (e.code === 'Escape') {
      this.onExit()
      return
    }
    if (e.code === 'KeyR') {
      this.reset()
      return
    }
    if (e.code === 'Enter' && this.status === 'won') {
      this.deaths = 0
      this.reset()
      return
    }
    this.held.add(e.code)
    if (Object.values(KEYS).flat().includes(e.code)) e.preventDefault()
  }

  keyUp(e) {
    this.held.delete(e.code)
  }

  pressed(action) {
    return KEYS[action].some((k) => this.held.has(k))
  }

  code(c, r) {
    if (r < 0 || r >= ROWS) return EMPTY
    if (c < 0 || c >= COLS) return '#'
    const ch = this.tiles[r][c]
    if (ch === 'm' && (this.crumble.get(`${c},${r}`) ?? 0) >= 1) return EMPTY
    return ch
  }

  behaviour(c, r) {
    return TILE_BY_CODE[this.code(c, r)]?.behaviour ?? null
  }

  isSolid(c, r) {
    return this.behaviour(c, r) === 'solid'
  }

  isStandable(c, r) {
    const b = this.behaviour(c, r)
    if (b === 'solid' || b === 'platform' || b === 'crumble' || b === 'slow')
      return true
    if (b === 'ladder') return this.code(c, r - 1) !== 'H'
    if (b === 'tree') return this.code(c, r - 1) !== 'T'
    return false
  }

  span(x, w) {
    return [Math.floor((x - w / 2) / TILE), Math.floor((x + w / 2 - 1) / TILE)]
  }

  supported(x, y, w) {
    if (y % TILE !== 0) return false
    const r = y / TILE
    const [c0, c1] = this.span(x, w)
    for (let c = c0; c <= c1; c++) if (this.isStandable(c, r)) return true
    return false
  }

  moveX(body, w, h, dx) {
    if (!dx) return false
    const nx = body.x + dx
    const edge = dx > 0 ? nx + w / 2 - 1 : nx - w / 2
    const c = Math.floor(edge / TILE)
    const r0 = Math.floor((body.y - h) / TILE),
      r1 = Math.floor((body.y - 1) / TILE)
    for (let r = r0; r <= r1; r++) {
      if (this.isSolid(c, r)) {
        body.x = dx > 0 ? c * TILE - w / 2 : (c + 1) * TILE + w / 2
        return true
      }
    }
    body.x = nx
    return false
  }

  update() {
    this.frame++
    updateWeather(this.weather, () => thunder())
    if (this.status === 'dead') {
      if (++this.timer > 70) this.reset()
      return
    }
    if (this.status === 'won') return

    this.updateHero()
    this.updateSkeletons()
    this.checkPickupsAndDanger()
  }

  updateHero() {
    const h = this.hero
    const { w, h: hh } = HERO_BOX
    const P = PHYSICS
    const input =
      (this.pressed('right') ? 1 : 0) - (this.pressed('left') ? 1 : 0)
    const cc = Math.floor(h.x / TILE)
    h.t++
    h.moving = false

    const ladderInBody = () => {
      const r0 = Math.floor((h.y - hh) / TILE),
        r1 = Math.floor((h.y - 1) / TILE)
      for (let r = r0; r <= r1; r++) if (this.code(cc, r) === 'H') return true
      return false
    }
    const ladderBelow = h.y % TILE === 0 && this.code(cc, h.y / TILE) === 'H'

    if (h.state !== 'climb') {
      const grabUp = this.pressed('up') && ladderInBody()
      const grabDown =
        this.pressed('down') && h.state === 'ground' && ladderBelow
      if (grabUp || grabDown) {
        h.state = 'climb'
        h.x = cc * TILE + TILE / 2
        h.vy = 0
      }
    }

    if (h.state === 'climb') {
      const dy = (this.pressed('down') ? 1 : 0) - (this.pressed('up') ? 1 : 0)
      if (this.pressed('jump')) {
        this.startJump(input)
        return
      }
      if (input && h.y % TILE === 0 && this.supported(h.x, h.y, w)) {
        h.state = 'ground'
      } else if (dy) {
        h.moving = true
        h.y += dy * P.climbSpeed
        const feetRow = Math.floor((h.y - 1) / TILE)
        if (this.code(cc, feetRow) !== 'H') {
          if (dy < 0) {
            h.y = (feetRow + 1) * TILE
            h.state = 'ground'
          } else {
            h.y = feetRow * TILE
            if (this.supported(h.x, h.y, w)) h.state = 'ground'
            else this.startFall()
          }
        }
        return
      } else {
        return
      }
    }

    if (h.state === 'ground') {
      if (this.pressed('jump')) {
        this.startJump(input)
      } else {
        if (input) {
          h.dir = input
          h.moving = true
          const onSwamp = this.code(cc, h.y / TILE) === 'w'
          this.moveX(h, w, hh, input * (onSwamp ? P.swampSpeed : P.walkSpeed))
        }
        if (!this.supported(h.x, h.y, w)) this.startFall()
        else this.crumbleUnder(h)
        return
      }
    }

    h.vy = Math.min(h.vy + P.gravity, P.maxFall)
    h.airT++
    if (h.state === 'jump' && h.airT <= (2 * -P.jumpVelocity) / P.gravity) {
      if (this.moveX(h, w, hh, h.jumpDir * P.walkSpeed)) h.jumpDir = 0
    }
    const ny = h.y + h.vy
    if (h.vy < 0) {
      const headRow = Math.floor((ny - hh) / TILE)
      const [c0, c1] = this.span(h.x, w)
      let bonk = false
      for (let c = c0; c <= c1; c++) if (this.isSolid(c, headRow)) bonk = true
      if (bonk) {
        h.y = (headRow + 1) * TILE + hh
        h.vy = 0
      } else h.y = ny
    } else {
      const rowTop = Math.floor(ny / TILE) * TILE
      if (h.y <= rowTop && ny >= rowTop && this.supported(h.x, rowTop, w)) {
        h.y = rowTop
        const fell = h.y - h.peakY
        h.state = 'ground'
        h.vy = 0
        if (P.fatalFallTiles && fell > P.fatalFallTiles * TILE) this.die()
      } else {
        h.y = ny
      }
    }
    h.peakY = Math.min(h.peakY, h.y)
    if (h.y - hh > VIEW_H) this.die()
  }

  startJump(dir) {
    const h = this.hero
    h.state = 'jump'
    h.vy = PHYSICS.jumpVelocity
    h.jumpDir = dir
    if (dir) h.dir = dir
    h.peakY = h.y
    h.airT = 0
  }

  startFall() {
    const h = this.hero
    h.state = 'fall'
    h.vy = 0
    h.jumpDir = 0
    h.peakY = h.y
    h.airT = 0
  }

  crumbleUnder(h) {
    const r = h.y / TILE
    const [c0, c1] = this.span(h.x, HERO_BOX.w)
    for (let c = c0; c <= c1; c++) {
      if (this.code(c, r) === 'm') {
        const key = `${c},${r}`
        this.crumble.set(
          key,
          (this.crumble.get(key) ?? 0) + 1 / PHYSICS.crumbleTime,
        )
      }
    }
  }

  updateSkeletons() {
    const { w, h } = SKELETON_BOX
    for (const s of this.skeletons) {
      s.t++
      if (!this.supported(s.x, s.y, w)) {
        s.vy = Math.min(s.vy + PHYSICS.gravity, PHYSICS.maxFall)
        const ny = s.y + s.vy
        const rowTop = Math.floor(ny / TILE) * TILE
        if (s.y <= rowTop && ny >= rowTop && this.supported(s.x, rowTop, w)) {
          s.y = rowTop
          s.vy = 0
        } else s.y = ny
        continue
      }
      const aheadX = s.x + s.dir * (w / 2 + SKELETON_SPEED)
      const ac = Math.floor(aheadX / TILE)
      const blocked =
        this.isSolid(ac, Math.floor((s.y - 1) / TILE)) ||
        this.isSolid(ac, Math.floor((s.y - h) / TILE))
      const floor = this.isStandable(ac, s.y / TILE)
      if (blocked || !floor) s.dir = -s.dir
      else s.x += s.dir * SKELETON_SPEED
    }
  }

  checkPickupsAndDanger() {
    const h = this.hero
    const box = {
      l: h.x - HERO_BOX.w / 2,
      r: h.x + HERO_BOX.w / 2,
      t: h.y - HERO_BOX.h,
      b: h.y,
    }
    const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t

    for (const rel of this.relics) {
      if (rel.got) continue
      const rb = {
        l: rel.c * TILE + 3,
        r: rel.c * TILE + 13,
        t: rel.r * TILE + 2,
        b: rel.r * TILE + 14,
      }
      if (overlap(box, rb)) rel.got = true
    }

    const inner = { l: box.l + 2, r: box.r - 2, t: box.t + 4, b: box.b - 2 }
    for (
      let r = Math.floor(inner.t / TILE);
      r <= Math.floor(inner.b / TILE);
      r++
    ) {
      for (
        let c = Math.floor(inner.l / TILE);
        c <= Math.floor(inner.r / TILE);
        c++
      ) {
        if (this.behaviour(c, r) === 'hazard') {
          this.die()
          return
        }
      }
    }

    for (const s of this.skeletons) {
      const sb = {
        l: s.x - SKELETON_BOX.w / 2 + 2,
        r: s.x + SKELETON_BOX.w / 2 - 2,
        t: s.y - SKELETON_BOX.h + 4,
        b: s.y,
      }
      if (overlap(inner, sb)) {
        this.die()
        return
      }
    }

    if (this.exit && this.exitOpen) {
      const eb = {
        l: this.exit.c * TILE + 8,
        r: this.exit.c * TILE + 24,
        t: (this.exit.r - 1) * TILE + 8,
        b: (this.exit.r + 1) * TILE,
      }
      if (overlap(box, eb)) this.status = 'won'
    }
  }

  die() {
    if (this.status !== 'playing') return
    this.status = 'dead'
    this.timer = 0
    this.deaths++
  }

  draw(ctx) {
    const f = this.frame
    drawBackdrop(ctx, this.zone)
    drawWeatherBack(ctx, this.weather)
    drawTiles(ctx, { tiles: this.tiles }, f, this.crumble)
    if (this.exit)
      drawExit(ctx, this.exit.c, this.exit.r, this.zone, this.exitOpen, f)
    for (const rel of this.relics)
      if (!rel.got) drawRelic(ctx, rel.c, rel.r, f)
    for (const s of this.skeletons) {
      drawSprite(
        ctx,
        this.sprites.skeleton,
        'walk',
        frameAt(this.sprites.skeleton, 'walk', s.t),
        s.x,
        s.y,
        s.dir < 0,
      )
    }
    this.drawHero(ctx)
    drawWeatherFront(ctx, this.weather)
    this.drawHud(ctx)

    if (this.status === 'dead') {
      ctx.fillStyle = `rgba(120,10,10,${0.4 * Math.abs(Math.sin(this.timer / 6))})`
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      banner(ctx, 'You have perished', '#c86a5a')
    }
    if (this.status === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      banner(
        ctx,
        'The tale is remembered',
        this.zone.accent,
        'ENTER TO PLAY AGAIN  ·  ESC FOR THE EDITOR',
      )
    }
  }

  drawHero(ctx) {
    const h = this.hero
    const sheet = this.sprites.sally
    if (this.status === 'dead' && Math.floor(this.timer / 4) % 2) return
    let anim = 'idle',
      fr = frameAt(sheet, 'idle', h.t)
    if (h.state === 'climb') {
      anim = 'climb'
      fr = Math.floor(h.y / 6) % 2
    } else if (h.state === 'jump' && h.vy < 0) {
      anim = 'jump'
      fr = 0
    } else if (h.state === 'jump' || h.state === 'fall') {
      anim = 'fall'
      fr = 0
    } else if (h.moving) {
      anim = 'walk'
      fr = Math.floor(h.x / 4) % 4
    }
    drawSprite(ctx, sheet, anim, fr, h.x, h.y, h.dir < 0)
  }

  drawHud(ctx) {
    const y = VIEW_H
    ctx.fillStyle = '#08070a'
    ctx.fillRect(0, y, VIEW_W, HUD_H)
    ctx.fillStyle = this.zone.accent
    ctx.globalAlpha = 0.6
    ctx.fillRect(0, y, VIEW_W, 1)
    ctx.globalAlpha = 1
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.font = '13px Almendra, serif'
    ctx.fillStyle = this.zone.accent
    ctx.fillText(this.zone.name, 6, y + 2)
    ctx.font = '16px VT323, monospace'
    ctx.fillStyle = '#cfc6b2'
    ctx.fillText(this.source.name, 6, y + 16)

    const got = this.relics.filter((r) => r.got).length
    ctx.textAlign = 'right'
    ctx.fillStyle = '#cfc6b2'
    ctx.fillText(`RELICS ${got}/${this.relics.length}`, VIEW_W - 6, y + 2)
    ctx.fillStyle = '#9a5a4e'
    ctx.fillText(`DEATHS ${this.deaths}`, VIEW_W - 6, y + 16)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#5e566a'
    ctx.fillText('QAOP / ARROWS   SPACE JUMP', VIEW_W / 2, y + 2)
    ctx.fillText('R RESTART   ESC EDITOR', VIEW_W / 2, y + 16)
  }
}

function banner(ctx, text, colour, sub) {
  const h = sub ? 52 : 38
  const top = VIEW_H / 2 - 24
  ctx.fillStyle = 'rgba(4,3,6,0.85)'
  ctx.fillRect(0, top, VIEW_W, h)
  ctx.fillStyle = colour
  ctx.globalAlpha = 0.5
  ctx.fillRect(0, top, VIEW_W, 1)
  ctx.fillRect(0, top + h - 1, VIEW_W, 1)
  ctx.globalAlpha = 1
  ctx.font = '26px Almendra, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = colour
  ctx.fillText(text, VIEW_W / 2, top + 5)
  if (sub) {
    ctx.font = '16px VT323, monospace'
    ctx.fillStyle = '#cfc6b2'
    ctx.fillText(sub, VIEW_W / 2, top + 34)
  }
}
