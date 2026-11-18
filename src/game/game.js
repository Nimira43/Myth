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
  drawSeed,
  drawObol,
  drawLabrys,
  drawTorch,
  drawThrones,
  drawFerry,
  drawCerberus,
  drawDarkness,
  drawThread,
  createWeather,
  updateWeather,
  drawWeatherBack,
  drawWeatherFront,
} from '../render.js'
import { unlockAudio, thunder } from '../audio.js'
import { drawSprite, frameAt } from '../sprites.js'
import { cloneLevel, ferryRoute } from '../level.js'

const KEYS = {
  left: ['ArrowLeft', 'KeyO'],
  right: ['ArrowRight', 'KeyP'],
  up: ['ArrowUp', 'KeyQ'],
  down: ['ArrowDown', 'KeyA'],
  jump: ['Space'],
}

const FERRY_W = 48
const FERRY_SPEED = 0.9
const FERRY_BOARD_DELAY = 30
const SHADE_SPEED = 0.5
const SHADE_BOX = { w: 10, h: 26 }
const CERBERUS = {
  chain: 3 * TILE,
  sight: 3 * TILE + 24,
  lunge: 3,
  back: 0.8,
  snarl: 24,
  rest: 150,
  w: 30,
  h: 20,
}
const MINOTAUR = {
  walk: 0.7,
  charge: 3.2,
  sight: 9 * TILE,
  paw: 36,
  stunWall: 100,
  stunEdge: 50,
  w: 16,
  h: 32,
}
const THREAD_STEP = 6
const LIGHT = { sally: 62, torch: 46, exit: 40 }

const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t

export class Game {
  constructor(level, zone, sprites, { onExit }) {
    this.source = cloneLevel(level)
    this.zone = zone
    this.sprites = sprites
    this.onExit = onExit
    this.held = new Set()
    this.deaths = 0
    this.frame = 0
    this.setting = this.source.setting ?? 'storm'
    this.weather = createWeather(
      7,
      ['underworld', 'labyrinth'].includes(this.setting)
        ? this.setting
        : 'storm',
    )
    this.intro = { t: 0 }
    unlockAudio()
    this.reset()
  }

  reset() {
    const lvl = cloneLevel(this.source)
    const ents = lvl.entities
    const of = (type) => ents.filter((e) => e.type === type)
    this.tiles = lvl.tiles
    this.crumble = new Map()
    const spawn = ents.find((e) => e.type === 'spawn') ?? { c: 2, r: ROWS - 2 }
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
    this.items = [
      ...of('relic'),
      ...of('seed'),
      ...of('obol'),
      ...of('labrys'),
    ].map((e) => ({ ...e, got: false }))
    this.torches = of('torch')
    this.obols = 0
    this.seedsTotal = of('seed').length
    this.thrones = ents.find((e) => e.type === 'thrones') ?? null
    this.offered = false
    this.exit = ents.find((e) => e.type === 'exit') ?? null

    this.skeletons = of('skeleton').map((e) => ({
      x: e.c * TILE + TILE / 2,
      y: (e.r + 1) * TILE,
      dir: e.dir ?? 1,
      vy: 0,
      t: 0,
    }))
    this.shades = of('shade').map((e) => ({
      x: e.c * TILE + TILE / 2,
      y: (e.r + 1) * TILE,
      dir: e.dir ?? 1,
      t: 0,
    }))
    this.ferries = of('ferry').map((e) => {
      const route = ferryRoute(lvl, e) ?? [e.c, e.c]
      const minX = route[0] * TILE,
        maxX = route[1] * TILE
      const x = Math.max(minX, Math.min(maxX, e.c * TILE))
      return {
        x,
        deckY: (e.r + 1) * TILE,
        minX,
        maxX,
        vx: 0,
        dir: x - minX <= maxX - x ? 1 : -1,
        boardT: 0,
        waitForLeave: false,
        warned: false,
      }
    })
    this.cerberi = of('cerberus').map((e) => {
      const post = e.c * TILE + TILE
      return {
        post,
        x: post,
        y: (e.r + 1) * TILE,
        home: (e.dir ?? -1) < 0 ? -1 : 1,
        dir: (e.dir ?? -1) < 0 ? -1 : 1,
        state: 'guard',
        timer: 0,
        t: 0,
      }
    })

    this.minotaurs = of('minotaur').map((e) => ({
      x: e.c * TILE + TILE,
      y: (e.r + 1) * TILE,
      dir: (e.dir ?? 1) < 0 ? -1 : 1,
      state: 'patrol',
      timer: 0,
      vy: 0,
      t: 0,
    }))

    this.thread = null
    if (this.setting === 'labyrinth') {
      const anchor = this.exit
        ? { x: this.exit.c * TILE + TILE, y: (this.exit.r + 1) * TILE - 8 }
        : { x: this.hero.x, y: this.hero.y - 8 }
      this.thread = { points: [anchor], broken: false }
    }

    this.msg = null
    this.thronesWarned = false
    this.exitWarned = false
    this.status = 'playing'
    this.timer = 0
  }

  get collected() {
    const got = (type) =>
      this.items.filter((i) => i.type === type && i.got).length
    const all = (type) => this.items.filter((i) => i.type === type).length
    return {
      relics: got('relic'),
      relicsTotal: all('relic'),
      seeds: got('seed'),
      axes: got('labrys'),
      axesTotal: all('labrys'),
    }
  }

  get exitOpen() {
    const c = this.collected
    if (c.relics < c.relicsTotal) return false
    if (c.axes < c.axesTotal) return false
    if (this.thread && this.thread.broken) return false
    if (this.thrones) return this.offered
    return c.seeds >= this.seedsTotal
  }

  say(text, frames = 180) {
    this.msg = { text, t: frames, max: frames }
  }

  keyDown(e) {
    unlockAudio()
    if (e.code === 'Escape') {
      this.onExit()
      return
    }
    if (this.intro && this.intro.t > 20) {
      this.intro = null
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

  ferryAt(x, y, w) {
    for (const f of this.ferries) {
      if (y === f.deckY && x + w / 2 > f.x + 2 && x - w / 2 < f.x + FERRY_W - 2)
        return f
    }
    return null
  }

  supported(x, y, w) {
    if (y % TILE !== 0) return false
    if (this.ferryAt(x, y, w)) return true
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
    if (this.msg && --this.msg.t <= 0) this.msg = null
    if (this.intro) {
      if (++this.intro.t > 300) this.intro = null
      return
    }
    if (this.status === 'dead') {
      if (++this.timer > 70) this.reset()
      return
    }
    if (this.status === 'won') return

    this.updateFerries()
    this.updateHero()
    this.updateSkeletons()
    this.updateShades()
    this.updateCerberi()
    this.updateMinotaurs()
    this.updateThread()
    this.checkPickupsAndDanger()
  }

  updateFerries() {
    const h = this.hero
    for (const f of this.ferries) {
      const aboard =
        h.state === 'ground' && this.ferryAt(h.x, h.y, HERO_BOX.w) === f
      if (f.vx) {
        const nx = Math.max(f.minX, Math.min(f.maxX, f.x + f.vx))
        const moved = nx - f.x
        f.x = nx
        if (aboard) h.x += moved
        if (f.x === f.minX || f.x === f.maxX) {
          f.vx = 0
          f.dir = f.x === f.minX ? 1 : -1
          f.waitForLeave = true
        }
        continue
      }
      if (!aboard) {
        f.boardT = 0
        f.waitForLeave = false
        f.warned = false
        continue
      }
      if (f.waitForLeave) continue
      if (++f.boardT < FERRY_BOARD_DELAY) continue
      if (this.obols > 0) {
        this.obols--
        f.vx = f.dir * FERRY_SPEED
        this.say('Charon takes the obol, and pushes off into the dark.')
      } else if (!f.warned) {
        f.warned = true
        this.say('Charon will not carry the living without an obol.')
      }
    }
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
    h.input = input

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

  updateShades() {
    const c = (s) => Math.floor(s.x / TILE)
    for (const s of this.shades) {
      s.t++
      const ny = s.y + s.dir * SHADE_SPEED
      const probeRow =
        s.dir > 0
          ? Math.floor(ny / TILE)
          : Math.floor((ny - SHADE_BOX.h) / TILE)
      const offScreen = s.dir > 0 ? ny > VIEW_H : ny - SHADE_BOX.h < 0
      if (offScreen || this.isSolid(c(s), probeRow)) s.dir = -s.dir
      else s.y = ny
    }
  }

  updateCerberi() {
    const h = this.hero
    const exitX = this.exit ? this.exit.c * TILE + TILE : null
    for (const cb of this.cerberi) {
      cb.t++
      const exitDir =
        exitX === null ? -cb.home : Math.sign(exitX - cb.post) || -cb.home
      switch (cb.state) {
        case 'guard': {
          cb.dir = Math.sign(h.x - cb.x) || cb.home
          const near =
            Math.abs(h.x - cb.x) <= CERBERUS.sight && Math.abs(h.y - cb.y) < 24
          if (near && h.input === exitDir && this.status === 'playing') {
            cb.state = 'lunge'
            cb.dir = Math.sign(h.x - cb.x) || cb.home
          }
          break
        }
        case 'lunge': {
          cb.x += cb.dir * CERBERUS.lunge
          if (Math.abs(cb.x - cb.post) >= CERBERUS.chain) {
            cb.x = cb.post + Math.sign(cb.x - cb.post) * CERBERUS.chain
            cb.state = 'snarl'
            cb.timer = CERBERUS.snarl
          }
          break
        }
        case 'snarl':
          if (--cb.timer <= 0) cb.state = 'return'
          break
        case 'return': {
          const d = cb.post - cb.x
          cb.dir = Math.sign(d) || cb.home
          if (Math.abs(d) <= CERBERUS.back) {
            cb.x = cb.post
            cb.state = 'rest'
            cb.timer = CERBERUS.rest
          } else cb.x += cb.dir * CERBERUS.back
          break
        }
        case 'rest':
          if (--cb.timer <= 0) cb.state = 'guard'
          break
      }
    }
  }

  updateMinotaurs() {
    const h = this.hero
    const { w, h: mh } = MINOTAUR
    for (const m of this.minotaurs) {
      m.t++
      if (!this.supported(m.x, m.y, w)) {
        m.vy = Math.min(m.vy + PHYSICS.gravity, PHYSICS.maxFall)
        const ny = m.y + m.vy
        const rowTop = Math.floor(ny / TILE) * TILE
        if (m.y <= rowTop && ny >= rowTop && this.supported(m.x, rowTop, w)) {
          m.y = rowTop
          m.vy = 0
        } else m.y = ny
        continue
      }
      const ahead = (speed) => {
        const ac = Math.floor((m.x + m.dir * (w / 2 + speed)) / TILE)
        const wall =
          this.isSolid(ac, Math.floor((m.y - 1) / TILE)) ||
          this.isSolid(ac, Math.floor((m.y - mh + 2) / TILE))
        const floor = this.isStandable(ac, m.y / TILE)
        return { wall, floor }
      }
      switch (m.state) {
        case 'patrol': {
          const a = ahead(MINOTAUR.walk)
          if (a.wall || !a.floor) m.dir = -m.dir
          else m.x += m.dir * MINOTAUR.walk
          if (this.status === 'playing' && this.canSee(m)) {
            m.state = 'paw'
            m.timer = MINOTAUR.paw
          }
          break
        }
        case 'paw':
          if (--m.timer <= 0) m.state = 'charge'
          break
        case 'charge': {
          const a = ahead(MINOTAUR.charge)
          if (a.wall || !a.floor) {
            m.state = 'stunned'
            m.timer = a.wall ? MINOTAUR.stunWall : MINOTAUR.stunEdge
            if (a.wall)
              this.say('The Minotaur crashes into the wall, dazed.', 100)
          } else {
            m.x += m.dir * MINOTAUR.charge
          }
          break
        }
        case 'stunned':
          if (--m.timer <= 0) {
            m.state = 'patrol'
            m.dir = -m.dir
          }
          break
      }
      if (this.thread) this.trampleThread(m)
    }
  }

  canSee(m) {
    const h = this.hero
    const dx = h.x - m.x
    if (Math.sign(dx) !== m.dir || Math.abs(dx) > MINOTAUR.sight) return false
    if (Math.abs(h.y - m.y) > 20) return false
    const r = Math.floor((m.y - 8) / TILE)
    const c0 = Math.floor(Math.min(h.x, m.x) / TILE),
      c1 = Math.floor(Math.max(h.x, m.x) / TILE)
    for (let c = c0; c <= c1; c++) if (this.isSolid(c, r)) return false
    return true
  }

  trampleThread(m) {
    const t = this.thread
    const box = {
      l: m.x - MINOTAUR.w / 2,
      r: m.x + MINOTAUR.w / 2,
      t: m.y - MINOTAUR.h,
      b: m.y,
    }
    for (let i = 1; i < t.points.length; i++) {
      const p = t.points[i]
      if (p.x >= box.l && p.x <= box.r && p.y >= box.t && p.y <= box.b) {
        const wasWhole = !t.broken
        t.points.length = i
        t.broken = true
        if (wasWhole)
          this.say(
            'The Minotaur has trampled the thread! Find the loose end.',
            200,
          )
        return
      }
    }
  }

  updateThread() {
    const t = this.thread
    if (!t || this.status !== 'playing') return
    const h = this.hero
    const here = { x: h.x, y: h.y - 8 }
    const pts = t.points
    const last = pts[pts.length - 1]
    const d = Math.hypot(here.x - last.x, here.y - last.y)
    if (t.broken) {
      if (d < 10) {
        t.broken = false
        this.say('You find the loose end, and take up the thread again.', 140)
      }
      return
    }
    for (let k = pts.length - 4; k >= 0; k--) {
      if (Math.hypot(here.x - pts[k].x, here.y - pts[k].y) < 5) {
        pts.length = k + 1
        return
      }
    }
    if (d > THREAD_STEP) pts.push(here)
  }

  checkPickupsAndDanger() {
    const h = this.hero
    const box = {
      l: h.x - HERO_BOX.w / 2,
      r: h.x + HERO_BOX.w / 2,
      t: h.y - HERO_BOX.h,
      b: h.y,
    }

    for (const it of this.items) {
      if (it.got) continue
      const ib = {
        l: it.c * TILE + 3,
        r: it.c * TILE + 13,
        t: it.r * TILE + 2,
        b: it.r * TILE + 14,
      }
      if (overlap(box, ib)) {
        it.got = true
        if (it.type === 'obol') {
          this.obols++
          this.say('An obol: the ferryman’s fare.', 120)
        }
        if (it.type === 'seed') {
          const n = this.collected.seeds
          this.say(
            n === this.seedsTotal
              ? 'The last seed. Take them to the thrones.'
              : `A pomegranate seed (${n} of ${this.seedsTotal}).`,
            120,
          )
        }
      }
    }

    if (this.thrones && !this.offered) {
      const t = this.thrones
      const tb = {
        l: t.c * TILE + 4,
        r: (t.c + 3) * TILE - 4,
        t: (t.r - 1) * TILE,
        b: (t.r + 1) * TILE,
      }
      if (overlap(box, tb)) {
        if (this.collected.seeds >= this.seedsTotal) {
          this.offered = true
          this.say(
            'The thrones accept the seeds of Persephone. Far below, the gates unseal.',
            240,
          )
        } else if (!this.thronesWarned) {
          this.thronesWarned = true
          const left = this.seedsTotal - this.collected.seeds
          this.say(
            `The thrones wait for ${left} more pomegranate seed${left === 1 ? '' : 's'}.`,
          )
        }
      } else {
        this.thronesWarned = false
      }
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
    for (const s of this.shades) {
      const sb = {
        l: s.x - SHADE_BOX.w / 2,
        r: s.x + SHADE_BOX.w / 2,
        t: s.y - SHADE_BOX.h,
        b: s.y - 2,
      }
      if (overlap(inner, sb)) {
        this.die()
        return
      }
    }
    for (const m of this.minotaurs) {
      const mb = {
        l: m.x - MINOTAUR.w / 2,
        r: m.x + MINOTAUR.w / 2,
        t: m.y - MINOTAUR.h + 4,
        b: m.y,
      }
      if (overlap(inner, mb)) {
        this.die()
        return
      }
    }
    for (const cb of this.cerberi) {
      const half = CERBERUS.w / 2
      const cbx = {
        l: cb.x - half + 2,
        r: cb.x + half - 2,
        t: cb.y - CERBERUS.h,
        b: cb.y,
      }
      if (overlap(inner, cbx)) {
        this.die()
        return
      }
    }

    if (this.exit) {
      const eb = {
        l: this.exit.c * TILE + 8,
        r: this.exit.c * TILE + 24,
        t: (this.exit.r - 1) * TILE + 8,
        b: (this.exit.r + 1) * TILE,
      }
      if (overlap(box, eb)) {
        if (this.exitOpen) this.status = 'won'
        else if (!this.exitWarned && this.thread) {
          this.exitWarned = true
          const c = this.collected
          if (c.axes < c.axesTotal)
            this.say('The double axes still lie somewhere in the dark.')
          else if (this.thread.broken)
            this.say('Without the whole thread, the way out cannot be found.')
        }
      } else {
        this.exitWarned = false
      }
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
    drawBackdrop(ctx, this.zone, this.setting)
    drawWeatherBack(ctx, this.weather)
    drawTiles(ctx, { tiles: this.tiles }, f, this.crumble)
    if (this.thrones)
      drawThrones(ctx, this.thrones.c, this.thrones.r, f, this.offered)
    if (this.exit)
      drawExit(
        ctx,
        this.exit.c,
        this.exit.r,
        this.zone,
        this.exitOpen,
        f,
        this.exit.style,
      )
    for (const t of this.torches) drawTorch(ctx, t.c, t.r, f)
    for (const it of this.items) {
      if (it.got) continue
      if (it.type === 'relic') drawRelic(ctx, it.c, it.r, f)
      else if (it.type === 'seed') drawSeed(ctx, it.c, it.r, f)
      else if (it.type === 'labrys') drawLabrys(ctx, it.c, it.r, f)
      else drawObol(ctx, it.c, it.r, f)
    }
    for (const fy of this.ferries)
      drawFerry(ctx, fy.x, fy.deckY, fy.dir, this.sprites, f, fy.vx !== 0)
    for (const cb of this.cerberi) {
      const anim =
        cb.state === 'lunge'
          ? 'run'
          : cb.state === 'return'
            ? 'run'
            : cb.state === 'rest'
              ? 'rest'
              : 'idle'
      drawCerberus(ctx, this.sprites, cb.x, cb.y, cb.dir, anim, f, cb.post)
    }
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
    for (const m of this.minotaurs) {
      const anim = m.state === 'patrol' ? 'walk' : m.state
      drawSprite(
        ctx,
        this.sprites.minotaur,
        anim,
        frameAt(this.sprites.minotaur, anim, m.t),
        m.x,
        m.y,
        m.dir < 0,
      )
    }
    this.drawHero(ctx)
    for (const s of this.shades) {
      drawSprite(
        ctx,
        this.sprites.shade,
        'drift',
        frameAt(this.sprites.shade, 'drift', s.t),
        s.x,
        s.y,
        this.hero.x < s.x,
      )
    }
    if (this.setting === 'labyrinth') this.drawLabyrinthLight(ctx)
    drawWeatherFront(ctx, this.weather)
    this.drawHud(ctx)

    if (this.intro) {
      this.drawIntro(ctx)
      return
    }
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

  drawLabyrinthLight(ctx) {
    const f = this.frame
    const lights = [{ x: this.hero.x, y: this.hero.y - 16, r: LIGHT.sally }]
    for (const t of this.torches) {
      lights.push({
        x: t.c * TILE + 8,
        y: t.r * TILE + 4,
        r:
          LIGHT.torch + Math.sin(f / 4 + t.c) * 2 + Math.sin(f / 7.3 + t.r) * 2,
        warm: true,
      })
    }
    if (this.exit && this.exitOpen)
      lights.push({
        x: this.exit.c * TILE + TILE,
        y: this.exit.r * TILE,
        r: LIGHT.exit,
        warm: true,
      })
    drawDarkness(ctx, lights)
    if (this.thread) {
      const tail = this.thread.broken
        ? null
        : { x: this.hero.x, y: this.hero.y - 8 }
      drawThread(ctx, this.thread.points, tail, this.thread.broken, f)
    }
    for (const m of this.minotaurs) {
      const ex =
        m.x + m.dir * (m.state === 'charge' || m.state === 'paw' ? 9 : 6)
      const ey = m.y - (m.state === 'charge' || m.state === 'paw' ? 24 : 28)
      ctx.fillStyle = 'rgba(255,60,30,0.9)'
      ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1)
      ctx.fillStyle = 'rgba(255,60,30,0.25)'
      ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3)
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

  drawIntro(ctx) {
    const a = Math.min(1, this.intro.t / 30)
    ctx.fillStyle = `rgba(3,2,5,${0.82 * a})`
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.globalAlpha = a
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = this.zone.accent
    ctx.font = '14px Almendra, serif'
    ctx.fillText(this.zone.name.toUpperCase(), VIEW_W / 2, 70)
    ctx.font = '30px Almendra, serif'
    ctx.fillStyle = '#e8dcc0'
    ctx.fillText(this.source.name, VIEW_W / 2, 90)
    ctx.fillStyle = this.zone.accent
    ctx.fillRect(VIEW_W / 2 - 60, 132, 120, 1)
    if (this.source.intro) {
      ctx.font = 'italic 15px Almendra, serif'
      ctx.fillStyle = '#b8ae98'
      wrap(ctx, this.source.intro, VIEW_W / 2, 146, 400, 19)
    }
    ctx.font = '16px VT323, monospace'
    ctx.fillStyle = '#7d7486'
    ctx.fillText(
      'QAOP / ARROWS MOVE  ·  SPACE JUMP  ·  R RESTART  ·  ESC EDITOR',
      VIEW_W / 2,
      VIEW_H - 46,
    )
    if (this.intro.t > 20 && Math.floor(this.frame / 30) % 2)
      ctx.fillText('PRESS ANY KEY', VIEW_W / 2, VIEW_H - 28)
    ctx.globalAlpha = 1
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

    const c = this.collected
    const counters = []
    if (c.relicsTotal) counters.push(`RELICS ${c.relics}/${c.relicsTotal}`)
    if (this.seedsTotal) counters.push(`SEEDS ${c.seeds}/${this.seedsTotal}`)
    if (c.axesTotal) counters.push(`AXES ${c.axes}/${c.axesTotal}`)
    if (this.thread)
      counters.push(this.thread.broken ? 'THREAD CUT' : 'THREAD WHOLE')
    if (this.ferries.length || this.items.some((i) => i.type === 'obol'))
      counters.push(`OBOLS ${this.obols}`)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#cfc6b2'
    ctx.fillText(counters.join('   '), VIEW_W - 6, y + 2)
    ctx.fillStyle = '#9a5a4e'
    ctx.fillText(`DEATHS ${this.deaths}`, VIEW_W - 6, y + 16)

    if (this.msg) {
      const fade = Math.min(
        1,
        this.msg.t / 30,
        (this.msg.max - this.msg.t + 1) / 10,
      )
      ctx.font = 'italic 14px Almendra, serif'
      const w = ctx.measureText(this.msg.text).width + 24
      ctx.globalAlpha = fade
      ctx.fillStyle = 'rgba(4,3,6,0.78)'
      ctx.fillRect(VIEW_W / 2 - w / 2, 22, w, 20)
      ctx.fillStyle = this.zone.accent
      ctx.fillRect(VIEW_W / 2 - w / 2, 22, w, 1)
      ctx.fillRect(VIEW_W / 2 - w / 2, 41, w, 1)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#e0d4b8'
      ctx.fillText(this.msg.text, VIEW_W / 2, 25)
      ctx.globalAlpha = 1
    }
  }
}

function wrap(ctx, text, x, y, maxW, lineH) {
  const words = text.split(/\s+/)
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      y += lineH
      line = w
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, y)
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
