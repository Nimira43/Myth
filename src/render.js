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

export function drawBackdrop(ctx, zone) {
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

export function createWeather(seed = 1) {
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
  return {
    rand,
    drops,
    flash: 0,
    bolt: null,
    next: 180 + rand() * 300,
    thunder: [],
  }
}

export function updateWeather(w, onThunder) {
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
        if ((code === 'T') !== (pass === 0)) continue
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

export function drawExit(ctx, c, r, zone, open, frame) {
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

export function drawEntity(ctx, e, zone, sprites, frame) {
  const footX = e.c * TILE + TILE / 2
  const footY = (e.r + 1) * TILE
  switch (e.type) {
    case 'spawn':
      drawSprite(ctx, sprites.sally, 'idle', 0, footX, footY, false)
      break
    case 'exit':
      drawExit(ctx, e.c, e.r, zone, true, frame)
      break
    case 'relic':
      drawRelic(ctx, e.c, e.r, frame)
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
  }
}

export function drawGrid(ctx) {
  ctx.fillStyle = 'rgba(201,164,90,0.10)'
  for (let c = 1; c < COLS; c++) ctx.fillRect(c * TILE, 0, 1, VIEW_H)
  for (let r = 1; r < ROWS; r++) ctx.fillRect(0, r * TILE, VIEW_W, 1)
}
