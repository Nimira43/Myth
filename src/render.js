import { TILE, COLS, ROWS, VIEW_W, VIEW_H } from './config.js'
import { drawTile, neighbours, EMPTY } from './tiles.js'
import { drawSprite } from './sprites.js'

const backdrops = new Map()

function seeded(seed) {
  let s = seed >>> 0 || 1
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

function hashString(str) {
  let h = 2166136261
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

function deadTree(g, x, baseY, height, rand) {
  const branch = (bx, by, len, ang, w) => {
    if (len < 3 || w < 0.6) return
    const ex = bx + Math.sin(ang) * len
    const ey = by - Math.cos(ang) * len
    g.lineWidth = w
    g.beginPath()
    g.moveTo(bx, by)
    g.lineTo(ex, ey)
    g.stroke()
    const n = rand() < 0.35 ? 3 : 2
    for (let i = 0; i < n; i++) {
      branch(
        ex,
        ey,
        len * (0.55 + rand() * 0.25),
        ang + (rand() - 0.5) * 1.6,
        w * 0.65,
      )
    }
  }
  branch(
    x,
    baseY,
    height * 0.45,
    (rand() - 0.5) * 0.25,
    Math.max(2, height / 14),
  )
}

export function drawBackdrop(ctx, zone, setting = 'storm') {
  if (setting === 'underworld') {
    drawUnderworldBackdrop(ctx, zone)
    return
  }
  let cv = backdrops.get(zone.id)
  if (!cv) {
    cv = document.createElement('canvas')
    cv.width = VIEW_W
    cv.height = VIEW_H
    const g = cv.getContext('2d')
    const rand = seeded(hashString(zone.id))

    const grad = g.createLinearGradient(0, 0, 0, VIEW_H)
    grad.addColorStop(0, zone.sky[0])
    grad.addColorStop(0.55, zone.sky[1])
    grad.addColorStop(1, zone.sky[2])
    g.fillStyle = grad
    g.fillRect(0, 0, VIEW_W, VIEW_H)

    if (zone.aurora) {
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = zone.accent
        g.globalAlpha = 0.07
        for (let w = 18; w > 2; w -= 4) {
          g.lineWidth = w
          g.beginPath()
          for (let x = -10; x <= VIEW_W + 10; x += 8) {
            const y =
              50 +
              i * 22 +
              Math.sin(x / 70 + i * 2) * 16 +
              Math.sin(x / 23) * 4
            x < 0 ? g.moveTo(x, y) : g.lineTo(x, y)
          }
          g.stroke()
        }
      }
      g.globalAlpha = 1
    }

    const mx = 90 + rand() * (VIEW_W - 180),
      my = 38 + rand() * 20
    const halo = g.createRadialGradient(mx, my, 6, mx, my, 70)
    halo.addColorStop(0, zone.moon + '55')
    halo.addColorStop(1, zone.moon + '00')
    g.fillStyle = halo
    g.fillRect(mx - 70, my - 70, 140, 140)
    g.fillStyle = zone.moon
    g.beginPath()
    g.arc(mx, my, 11, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = zone.sky[0] + 'aa'
    g.beginPath()
    g.arc(mx + 4, my - 2, 9, 0, Math.PI * 2)
    g.fill()

    for (let i = 0; i < 9; i++) {
      const cy = 20 + rand() * 90,
        cx = rand() * VIEW_W,
        w = 80 + rand() * 160
      g.fillStyle = i % 3 === 0 ? zone.sky[2] : zone.sky[1]
      g.globalAlpha = 0.45 + rand() * 0.35
      for (let k = 0; k < 6; k++) {
        g.beginPath()
        g.ellipse(
          cx + ((k - 3) * w) / 6,
          cy + Math.sin(k) * 3,
          w / 5,
          5 + rand() * 4,
          0,
          0,
          Math.PI * 2,
        )
        g.fill()
      }
    }
    g.globalAlpha = 1

    g.fillStyle = zone.far
    g.globalAlpha = 0.85
    for (let x = 0; x < VIEW_W; x++) {
      const h =
        60 + Math.sin(x / 61 + zone.id.length) * 20 + Math.sin(x / 17) * 5
      g.fillRect(x, VIEW_H - h - 10, 1, h + 10)
    }
    g.globalAlpha = 1
    g.lineCap = 'round'
    g.strokeStyle = zone.far
    g.globalAlpha = 0.9
    for (let x = -10; x < VIEW_W + 10; x += 22 + rand() * 30) {
      deadTree(g, x, VIEW_H - 40 - rand() * 10, 40 + rand() * 30, rand)
    }
    g.strokeStyle = '#030305'
    g.globalAlpha = 1
    for (let x = -20; x < VIEW_W + 20; x += 50 + rand() * 70) {
      deadTree(g, x, VIEW_H + 4, 70 + rand() * 50, rand)
    }

    const mist = g.createLinearGradient(0, VIEW_H - 90, 0, VIEW_H)
    mist.addColorStop(0, zone.mist + '00')
    mist.addColorStop(1, zone.mist + '55')
    g.fillStyle = mist
    g.fillRect(0, VIEW_H - 90, VIEW_W, 90)

    backdrops.set(zone.id, cv)
  }
  ctx.drawImage(cv, 0, 0)
}

function drawUnderworldBackdrop(ctx, zone) {
  const key = zone.id + '|underworld'
  let cv = backdrops.get(key)
  if (!cv) {
    cv = document.createElement('canvas')
    cv.width = VIEW_W
    cv.height = VIEW_H
    const g = cv.getContext('2d')
    const rand = seeded(hashString(key))
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H)
    grad.addColorStop(0, '#020103')
    grad.addColorStop(0.5, '#0a0708')
    grad.addColorStop(1, '#1c0e0a')
    g.fillStyle = grad
    g.fillRect(0, 0, VIEW_W, VIEW_H)

    const glow = g.createRadialGradient(
      VIEW_W / 2,
      VIEW_H + 40,
      20,
      VIEW_W / 2,
      VIEW_H + 40,
      VIEW_W * 0.7,
    )
    glow.addColorStop(0, 'rgba(160,60,24,0.35)')
    glow.addColorStop(1, 'rgba(160,60,24,0)')
    g.fillStyle = glow
    g.fillRect(0, 0, VIEW_W, VIEW_H)

    g.fillStyle = '#120c0e'
    const baseY = VIEW_H - 70
    for (let x = 6; x < VIEW_W; x += 34) {
      const h = 90 + (x % 3) * 8
      g.fillRect(x, baseY - h, 10, h + 70)
      g.fillRect(x - 2, baseY - h, 14, 3)
    }
    g.fillRect(0, baseY - 104, VIEW_W, 6)
    g.fillStyle = '#0d090b'
    for (let x = 0; x < VIEW_W; x += 2) {
      const peak = 30 - Math.abs((x % 170) - 85) * 0.35
      if (peak > 0) g.fillRect(x, baseY - 104 - peak, 2, peak)
    }

    for (const [col, maxLen, step] of [
      ['#08060a', 60, 9],
      ['#030204', 38, 13],
    ]) {
      g.fillStyle = col
      g.fillRect(0, 0, VIEW_W, 6)
      for (let x = -4; x < VIEW_W; x += step * (0.6 + rand() * 0.8)) {
        const len = 8 + rand() * maxLen,
          w = 4 + rand() * 9
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x + w, 0)
        g.lineTo(x + w / 2 + (rand() - 0.5) * 3, len)
        g.closePath()
        g.fill()
      }
    }

    const mist = g.createLinearGradient(0, VIEW_H - 70, 0, VIEW_H)
    mist.addColorStop(0, 'rgba(120,128,140,0)')
    mist.addColorStop(1, 'rgba(120,128,140,0.25)')
    g.fillStyle = mist
    g.fillRect(0, VIEW_H - 70, VIEW_W, 70)
    backdrops.set(key, cv)
  }
  ctx.drawImage(cv, 0, 0)
}

export function createWeather(seed = 1, mode = 'storm') {
  const rand = seeded(seed * 7919 + 13)
  const drops = []
  for (let i = 0; i < 140; i++) {
    drops.push({
      x: rand() * VIEW_W,
      y: rand() * VIEW_H,
      len: 5 + rand() * 7,
      speed: 5 + rand() * 3,
    })
  }
  const motes = []
  for (let i = 0; i < 60; i++) {
    motes.push({
      x: rand() * VIEW_W,
      y: rand() * VIEW_H,
      vy: 0.15 + rand() * 0.35,
      ph: rand() * 6,
      ember: rand() < 0.35,
    })
  }
  return {
    mode,
    rand,
    drops,
    motes,
    flash: 0,
    bolt: null,
    next: 180 + rand() * 300,
    thunder: [],
    t: 0,
  }
}

export function updateWeather(w, onThunder) {
  w.t++
  if (w.mode === 'underworld') {
    for (const m of w.motes) {
      m.y -= m.vy
      m.x += Math.sin(w.t / 40 + m.ph) * 0.2
      if (m.y < -2) {
        m.y = VIEW_H + 2
        m.x = w.rand() * VIEW_W
      }
    }
    return
  }
  for (const d of w.drops) {
    d.y += d.speed
    d.x -= d.speed * 0.25
    if (d.y > VIEW_H) {
      d.y = -d.len
      d.x = w.rand() * (VIEW_W + 40)
    }
    if (d.x < -10) d.x += VIEW_W + 20
  }
  w.flash *= 0.88
  if (w.bolt && --w.bolt.life <= 0) w.bolt = null
  if (--w.next <= 0) {
    const pts = []
    let x = 40 + w.rand() * (VIEW_W - 80),
      y = 0
    while (y < 110 + w.rand() * 60) {
      pts.push([x, y])
      x += (w.rand() - 0.5) * 22
      y += 6 + w.rand() * 12
    }
    w.bolt = { pts, life: 7 }
    w.flash = 0.55 + w.rand() * 0.3
    w.next = w.rand() < 0.25 ? 10 + w.rand() * 10 : 240 + w.rand() * 420
    const delay = 20 + Math.floor(w.rand() * 50)
    w.thunder.push(delay)
  }
  for (let i = w.thunder.length - 1; i >= 0; i--) {
    if (--w.thunder[i] <= 0) {
      w.thunder.splice(i, 1)
      onThunder?.()
    }
  }
}

export function drawWeatherBack(ctx, w) {
  if (w.flash > 0.02) {
    ctx.fillStyle = `rgba(200,210,235,${w.flash * 0.35})`
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }
  if (w.bolt) {
    for (const [col, width] of [
      ['rgba(170,190,255,0.35)', 4],
      ['#eef2ff', 1.5],
    ]) {
      ctx.strokeStyle = col
      ctx.lineWidth = width
      ctx.beginPath()
      w.bolt.pts.forEach(([x, y], i) =>
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
      )
      ctx.stroke()
    }
  }
}

let vignette = null

export function drawWeatherFront(ctx, w, { rain = true } = {}) {
  if (w.mode === 'underworld') {
    for (const m of w.motes) {
      const flicker = m.ember ? 0.5 + 0.5 * Math.sin(w.t / 6 + m.ph) : 0.5
      ctx.fillStyle = m.ember
        ? `rgba(230,120,50,${0.3 + flicker * 0.5})`
        : 'rgba(160,150,140,0.35)'
      ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1)
    }
    rain = false
  }
  if (rain) {
    ctx.strokeStyle = 'rgba(170,185,210,0.28)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const d of w.drops) {
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(d.x - d.len * 0.25, d.y + d.len)
    }
    ctx.stroke()
  }
  if (w.flash > 0.02) {
    ctx.fillStyle = `rgba(225,232,255,${w.flash * 0.22})`
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }
  if (!vignette) {
    vignette = document.createElement('canvas')
    vignette.width = VIEW_W
    vignette.height = VIEW_H
    const g = vignette.getContext('2d')
    const r = g.createRadialGradient(
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_H * 0.35,
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_W * 0.65,
    )
    r.addColorStop(0, 'rgba(0,0,0,0)')
    r.addColorStop(1, 'rgba(0,0,0,0.6)')
    g.fillStyle = r
    g.fillRect(0, 0, VIEW_W, VIEW_H)
  }
  ctx.globalAlpha = 1 - w.flash * 0.6
  ctx.drawImage(vignette, 0, 0)
  ctx.globalAlpha = 1
}

export function drawTiles(ctx, level, frame = 0, crumble = null) {
  const grid = level.tiles
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < ROWS; r++) {
      const row = grid[r]
      for (let c = 0; c < COLS; c++) {
        const code = row[c]
        if (code === EMPTY) continue
        if ((code === 'T' || code === 'Y') !== (pass === 0)) continue
        let amount = 0
        if (crumble && code === 'm') {
          amount = crumble.get(`${c},${r}`) ?? 0
          if (amount >= 1) continue
        }
        const x = c * TILE,
          y = r * TILE
        if (amount > 0) {
          const cut = Math.ceil(amount * 8)
          ctx.save()
          ctx.beginPath()
          ctx.rect(x, y + cut, TILE, TILE)
          ctx.clip()
          drawTile(ctx, code, x, y + cut, neighbours(grid, c, r), c, r, frame)
          ctx.restore()
        } else {
          drawTile(ctx, code, x, y, neighbours(grid, c, r), c, r, frame)
        }
      }
    }
  }
}

export function drawExit(ctx, c, r, zone, open, frame, style = 'temple') {
  if (style === 'gates') {
    drawGates(ctx, c, r, open, frame)
    return
  }
  const x = c * TILE,
    y = (r - 1) * TILE
  const stone = '#8c867a',
    shade = '#4e4a42'
  for (const cx of [x + 1, x + 26]) {
    ctx.fillStyle = stone
    ctx.fillRect(cx, y + 5, 5, 27)
    ctx.fillStyle = shade
    ctx.fillRect(cx + 4, y + 5, 1, 27)
    ctx.fillStyle = stone
    ctx.fillRect(cx - 1, y + 29, 7, 3)
  }
  ctx.fillStyle = stone
  ctx.fillRect(x, y + 2, 32, 4)
  ctx.fillStyle = shade
  ctx.fillRect(x, y + 5, 32, 1)
  ctx.fillStyle = stone
  ctx.fillRect(x + 2, y + 1, 28, 1)
  ctx.fillRect(x + 6, y, 20, 1)
  ctx.fillRect(x + 10, y - 1, 12, 1)
  ctx.fillRect(x + 14, y - 2, 4, 1)
  ctx.fillStyle = '#120a18'
  ctx.fillRect(x + 6, y + 6, 20, 26)
  if (open) {
    for (let i = 0; i < 5; i++) {
      const a = frame / 10 + i * 1.3
      ctx.fillStyle = i % 2 ? zone.accent : '#ffffff'
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(frame / 6 + i)
      ctx.fillRect(
        x + 15 + Math.cos(a) * (3 + i * 1.4),
        y + 19 + Math.sin(a) * (4 + i * 2),
        2,
        2,
      )
    }
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(frame / 8)
    ctx.fillStyle = zone.accent
    ctx.fillRect(x + 6, y + 6, 20, 26)
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = '#3a2e44'
    for (let yy = 8; yy < 32; yy += 4) ctx.fillRect(x + 8, y + yy, 16, 1)
  }
}

function drawGates(ctx, c, r, open, frame) {
  const x = c * TILE,
    y = (r - 1) * TILE
  const bronze = '#8a6430',
    hi = '#c09048',
    dk = '#4a3418'
  ctx.fillStyle = bronze
  ctx.fillRect(x, y, 4, 32)
  ctx.fillRect(x + 28, y, 4, 32)
  ctx.fillRect(x, y, 32, 4)
  ctx.fillStyle = hi
  ctx.fillRect(x, y, 1, 32)
  ctx.fillRect(x + 28, y, 1, 32)
  ctx.fillRect(x, y, 32, 1)
  ctx.fillStyle = dk
  for (let k = 0; k < 7; k++) ctx.fillRect(x + 3 + k * 4, y + 2, 2, 1)
  if (open) {
    const pulse = 0.55 + 0.15 * Math.sin(frame / 10)
    ctx.fillStyle = `rgba(200,206,214,${pulse})`
    ctx.fillRect(x + 4, y + 4, 24, 28)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    for (let i = 0; i < 4; i++) {
      const py = y + 30 - ((frame * 0.6 + i * 9) % 26)
      ctx.fillRect(x + 8 + i * 5, py, 1, 2)
    }
    ctx.fillStyle = bronze
    ctx.fillRect(x + 4, y + 4, 3, 28)
    ctx.fillRect(x + 25, y + 4, 3, 28)
    ctx.fillStyle = dk
    ctx.fillRect(x + 6, y + 4, 1, 28)
    ctx.fillRect(x + 25, y + 4, 1, 28)
  } else {
    ctx.fillStyle = '#0a0806'
    ctx.fillRect(x + 4, y + 4, 24, 28)
    ctx.fillStyle = bronze
    for (let bx = x + 6; bx < x + 27; bx += 4) ctx.fillRect(bx, y + 4, 2, 28)
    ctx.fillRect(x + 4, y + 12, 24, 2)
    ctx.fillRect(x + 4, y + 24, 24, 2)
    ctx.fillStyle = dk
    ctx.fillRect(x + 15, y + 4, 2, 28)
    const glow = 0.45 + 0.35 * Math.sin(frame / 12)
    ctx.fillStyle = `rgba(200,40,24,${glow})`
    ctx.beginPath()
    ctx.arc(x + 16, y + 18, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(255,140,90,${glow})`
    ctx.fillRect(x + 15, y + 17, 2, 2)
  }
}

export function drawRelic(ctx, c, r, frame) {
  const bob = Math.round(Math.sin(frame / 10 + c) * 1.5)
  const x = c * TILE + 4,
    y = r * TILE + 3 + bob
  const gold = '#f0c040',
    dark = '#a8781c',
    light = '#fff0a0'
  ctx.fillStyle = dark
  ctx.fillRect(x + 3, y, 3, 1)
  ctx.fillRect(x + 1, y + 2, 1, 2)
  ctx.fillRect(x + 7, y + 2, 1, 2)
  ctx.fillStyle = gold
  ctx.fillRect(x + 3, y + 1, 3, 2)
  ctx.fillRect(x + 2, y + 3, 5, 1)
  ctx.fillRect(x + 1, y + 4, 7, 4)
  ctx.fillRect(x + 2, y + 8, 5, 1)
  ctx.fillRect(x + 3, y + 9, 3, 1)
  ctx.fillStyle = dark
  ctx.fillRect(x + 1, y + 6, 7, 1)
  ctx.fillStyle = light
  if (Math.floor(frame / 20 + c) % 6 === 0) ctx.fillRect(x + 2, y + 4, 1, 2)
  else ctx.fillRect(x + 2, y + 4, 1, 1)
}

export function drawSeed(ctx, c, r, frame) {
  const bob = Math.sin(frame / 12 + c * 1.7) * 1.5
  const cx = c * TILE + 8,
    cy = r * TILE + 8 + bob
  const halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, 8)
  halo.addColorStop(
    0,
    `rgba(220,30,50,${0.35 + 0.15 * Math.sin(frame / 8 + c)})`,
  )
  halo.addColorStop(1, 'rgba(220,30,50,0)')
  ctx.fillStyle = halo
  ctx.fillRect(cx - 8, cy - 8, 16, 16)
  ctx.fillStyle = '#7a0c1c'
  ctx.fillRect(cx - 2, cy - 3, 4, 6)
  ctx.fillRect(cx - 3, cy - 2, 6, 4)
  ctx.fillStyle = '#c8203a'
  ctx.fillRect(cx - 2, cy - 2, 4, 4)
  ctx.fillStyle = '#ff8a9a'
  ctx.fillRect(cx - 1, cy - 2, 1, 1)
}

export function drawObol(ctx, c, r, frame) {
  const cx = c * TILE + 8,
    cy = r * TILE + 9 + Math.sin(frame / 14 + c) * 1
  const w = Math.max(1, Math.round(Math.abs(Math.cos(frame / 14 + c)) * 4))
  ctx.fillStyle = '#5e646e'
  ctx.fillRect(cx - w - 1, cy - 4, w * 2 + 2, 8)
  ctx.fillStyle = '#c8ccd4'
  ctx.fillRect(cx - w, cy - 4, w * 2, 8)
  ctx.fillRect(cx - w - 1, cy - 3, w * 2 + 2, 6)
  if (w > 2) {
    ctx.fillStyle = '#8a909a'
    ctx.fillRect(cx - 1, cy - 2, 2, 3)
  }
  if (Math.floor(frame / 18 + c) % 5 === 0) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(cx - w, cy - 3, 1, 1)
  }
}

export function drawThrones(ctx, c, r, frame, offered = false) {
  const x = c * TILE,
    y = (r - 1) * TILE
  const ob = '#0e0c12',
    obHi = '#2a2636',
    bronze = '#8a6430',
    bronzeHi = '#c09048'
  ctx.fillStyle = ob
  ctx.fillRect(x, y + 27, 48, 5)
  ctx.fillStyle = obHi
  ctx.fillRect(x, y + 27, 48, 1)
  ctx.fillStyle = ob
  ctx.fillRect(x + 2, y + 2, 14, 25)
  ctx.fillRect(x + 1, y - 2, 3, 6)
  ctx.fillRect(x + 14, y - 2, 3, 6)
  ctx.fillStyle = bronze
  ctx.fillRect(x + 2, y + 16, 14, 2)
  ctx.fillRect(x + 2, y + 2, 1, 25)
  ctx.fillStyle = obHi
  ctx.fillRect(x + 4, y + 4, 10, 1)
  ctx.fillStyle = ob
  ctx.fillRect(x + 32, y + 6, 14, 21)
  ctx.fillStyle = bronze
  ctx.fillRect(x + 32, y + 16, 14, 2)
  ctx.fillRect(x + 45, y + 6, 1, 21)
  ctx.fillStyle = '#9a1428'
  ctx.fillRect(x + 37, y + 9, 4, 4)
  ctx.fillStyle = '#e04a5a'
  ctx.fillRect(x + 37, y + 9, 1, 1)
  ctx.fillStyle = bronze
  ctx.fillRect(x + 23, y + 18, 2, 9)
  ctx.fillRect(x + 19, y + 16, 10, 2)
  ctx.fillStyle = bronzeHi
  ctx.fillRect(x + 19, y + 16, 10, 1)
  if (offered) {
    const glow = ctx.createRadialGradient(
      x + 24,
      y + 14,
      1,
      x + 24,
      y + 14,
      22,
    )
    glow.addColorStop(
      0,
      `rgba(230,60,70,${0.45 + 0.15 * Math.sin(frame / 9)})`,
    )
    glow.addColorStop(1, 'rgba(230,60,70,0)')
    ctx.fillStyle = glow
    ctx.fillRect(x + 2, y - 8, 44, 44)
    ctx.fillStyle = '#c8203a'
    for (const dx of [-3, 0, 3]) ctx.fillRect(x + 23 + dx, y + 14, 2, 2)
  }
}

export function drawFerry(ctx, x, deckY, dir, sprites, frame, moving = false) {
  const wood = '#2a1e14',
    woodHi = '#4a3624',
    woodDk = '#120c08'
  ctx.fillStyle = wood
  ctx.fillRect(x, deckY, 48, 4)
  ctx.fillRect(x + 2, deckY + 4, 44, 3)
  ctx.fillRect(x + 5, deckY + 7, 38, 3)
  ctx.fillStyle = woodHi
  ctx.fillRect(x, deckY, 48, 1)
  ctx.fillStyle = woodDk
  for (let k = 8; k < 48; k += 10) ctx.fillRect(x + k, deckY + 1, 1, 6)
  const px = dir > 0 ? x + 46 : x - 1
  ctx.fillStyle = wood
  ctx.fillRect(px, deckY - 8, 3, 10)
  ctx.fillRect(px + (dir > 0 ? -2 : 2), deckY - 10, 3, 3)
  const lx = dir > 0 ? x + 40 : x + 7
  ctx.fillStyle = woodDk
  ctx.fillRect(lx, deckY - 16, 1, 16)
  ctx.fillRect(lx, deckY - 16, dir > 0 ? 4 : -3, 1)
  const lan = lx + (dir > 0 ? 3 : -3)
  const flick = 0.6 + 0.25 * Math.sin(frame / 3) + 0.15 * Math.sin(frame / 7)
  const glow = ctx.createRadialGradient(
    lan,
    deckY - 12,
    1,
    lan,
    deckY - 12,
    18,
  )
  glow.addColorStop(0, `rgba(160,220,170,${0.35 * flick})`)
  glow.addColorStop(1, 'rgba(160,220,170,0)')
  ctx.fillStyle = glow
  ctx.fillRect(lan - 18, deckY - 30, 36, 36)
  ctx.fillStyle = `rgba(200,255,210,${flick})`
  ctx.fillRect(lan - 1, deckY - 14, 2, 3)
  const sx = dir > 0 ? x + 10 : x + 38
  const anim = moving ? 'pole' : 'idle'
  const fr =
    Math.floor(frame / (moving ? 12 : 30)) %
    sprites.charon.meta.animations[anim].frames
  drawSprite(ctx, sprites.charon, anim, fr, sx, deckY, dir < 0)
}

export function drawCerberus(ctx, sprites, x, y, dir, anim, frame, postX) {
  // chain from the stake to the collar
  const collarX = x + dir * 12,
    collarY = y - 14
  ctx.fillStyle = '#3a3a40'
  ctx.fillRect(postX - 1, y - 6, 3, 6)
  ctx.fillStyle = '#5a5a62'
  const links = 10
  for (let i = 0; i <= links; i++) {
    const t = i / links
    const lx = postX + (collarX - postX) * t
    const ly = y - 4 + (collarY - (y - 4)) * t + Math.sin(t * Math.PI) * 4
    ctx.fillRect(Math.round(lx), Math.round(ly), 2, 1)
  }
  const fr =
    Math.floor(frame / (anim === 'run' ? 5 : 20)) %
    sprites.cerberus.meta.animations[anim].frames
  drawSprite(ctx, sprites.cerberus, anim, fr, x, y, dir < 0)
}

export function drawEntity(ctx, e, zone, sprites, frame, level = null) {
  const footX = e.c * TILE + TILE / 2
  const footY = (e.r + 1) * TILE
  switch (e.type) {
    case 'spawn':
      drawSprite(ctx, sprites.sally, 'idle', 0, footX, footY, false)
      break
    case 'exit':
      drawExit(ctx, e.c, e.r, zone, true, frame, e.style)
      break
    case 'relic':
      drawRelic(ctx, e.c, e.r, frame)
      break
    case 'seed':
      drawSeed(ctx, e.c, e.r, frame)
      break
    case 'obol':
      drawObol(ctx, e.c, e.r, frame)
      break
    case 'thrones':
      drawThrones(ctx, e.c, e.r, frame, false)
      break
    case 'ferry':
      drawFerry(ctx, e.c * TILE, footY, 1, sprites, frame, false)
      break
    case 'skeleton':
      drawSprite(
        ctx,
        sprites.skeleton,
        'walk',
        Math.floor(frame / 8) % 4,
        footX,
        footY,
        e.dir < 0,
      )
      break
    case 'shade':
      drawSprite(
        ctx,
        sprites.shade,
        'drift',
        Math.floor(frame / 10) % 4,
        footX,
        footY,
        false,
      )
      break
    case 'cerberus': {
      const cx = e.c * TILE + TILE
      drawCerberus(
        ctx,
        sprites,
        cx,
        footY,
        (e.dir ?? -1) < 0 ? -1 : 1,
        'idle',
        frame,
        cx,
      )
      break
    }
  }
}

export function drawGrid(ctx) {
  ctx.fillStyle = 'rgba(201,164,90,0.10)'
  for (let c = 1; c < COLS; c++) ctx.fillRect(c * TILE, 0, 1, VIEW_H)
  for (let r = 1; r < ROWS; r++) ctx.fillRect(0, r * TILE, VIEW_W, 1)
}
