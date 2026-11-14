import { TILE } from './config.js'

export const EMPTY = '.'

export const TILES = [
  {
    code: 'g',
    name: 'Grass',
    category: 'Ground',
    behaviour: 'platform',
    draw: drawGrass,
  },
  {
    code: 'm',
    name: 'Mud',
    category: 'Ground',
    behaviour: 'crumble',
    draw: drawMud,
  },
  {
    code: 's',
    name: 'Sand',
    category: 'Ground',
    behaviour: 'platform',
    draw: drawSand,
  },
  {
    code: 'w',
    name: 'Swamp',
    category: 'Ground',
    behaviour: 'slow',
    draw: drawSwamp,
  },
  {
    code: 'd',
    name: 'Dirt',
    category: 'Ground',
    behaviour: 'solid',
    draw: drawDirt,
  },
  {
    code: '~',
    name: 'Water',
    category: 'Ground',
    behaviour: 'hazard',
    draw: drawWater,
    animated: true,
  },
  {
    code: 'l',
    name: 'Grey Water',
    category: 'Ground',
    behaviour: 'hazard',
    draw: drawGreyWater,
    animated: true,
  },
  {
    code: '=',
    name: 'Wood',
    category: 'Ground',
    behaviour: 'platform',
    draw: drawWood,
  },
  {
    code: 'H',
    name: 'Ladder',
    category: 'Structure',
    behaviour: 'ladder',
    draw: drawLadder,
  },
  {
    code: 'T',
    name: 'Tree',
    category: 'Structure',
    behaviour: 'tree',
    draw: drawTree,
  },
  {
    code: '#',
    name: 'Stone',
    category: 'Structure',
    behaviour: 'solid',
    draw: drawStone,
  },
]

export const TILE_BY_CODE = Object.fromEntries(TILES.map((t) => [t.code, t]))

export const TILE_HINTS = {
  platform: 'Stand on top, jump up through it',
  crumble: 'Crumbles away when stood on',
  slow: 'Slows you down',
  solid: 'Solid wall – blocks every side',
  hazard: 'Deadly',
  ladder: 'Climb with ↑ / ↓',
  tree: 'Decoration – the canopy can be stood on',
}

const GROUNDISH = new Set(['g', 'm', 's', 'w', 'd', '#'])

const cache = new Map()

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return (h ^ (h >>> 16)) >>> 0
}

function rng(seed) {
  let s = seed || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function neighbours(grid, c, r) {
  const at = (cc, rr) => (grid[rr] && grid[rr][cc]) || EMPTY
  return {
    up: at(c, r - 1),
    down: at(c, r + 1),
    left: at(c - 1, r),
    right: at(c + 1, r),
  }
}

export function drawTile(ctx, code, x, y, n, c, r, frame = 0) {
  const def = TILE_BY_CODE[code]
  if (!def) return
  const variant = hash(c, r) % 4
  const anim = def.animated ? Math.floor(frame / 12) % 4 : 0
  const key = `${code}|${variantKey(code, n)}|${variant}|${anim}`
  let entry = cache.get(key)
  if (!entry) {
    const pad = 12
    const cv = document.createElement('canvas')
    cv.width = TILE + pad * 2
    cv.height = TILE + pad * 2
    const g = cv.getContext('2d')
    g.translate(pad, pad)
    def.draw(g, n, rng(variant * 977 + 13), anim)
    entry = { cv, pad }
    cache.set(key, entry)
  }
  ctx.drawImage(entry.cv, x - entry.pad, y - entry.pad)
}

function variantKey(code, n) {
  switch (code) {
    case 'T':
      return `${n.up === 'T'}${n.down === 'T'}`
    case 'H':
      return `${n.up === 'H'}`
    case '~':
      return `${n.up === '~'}`
    case 'l':
      return `${n.up === 'l'}`
    default:
      return `${GROUNDISH.has(n.up) || n.up === code}${GROUNDISH.has(n.down) || n.down === code}`
  }
}

const px = (g, x, y, w, h, col) => {
  g.fillStyle = col
  g.fillRect(x, y, w, h)
}

function speckle(g, rand, x, y, w, h, cols, count) {
  for (let i = 0; i < count; i++) {
    px(
      g,
      x + Math.floor(rand() * w),
      y + Math.floor(rand() * h),
      1,
      1,
      cols[Math.floor(rand() * cols.length)],
    )
  }
}

function ledgeHeight(n, code) {
  return GROUNDISH.has(n.down) || n.down === code ? TILE : 8
}

function raggedUnderside(g, rand, h, col) {
  if (h >= TILE) return
  for (let x = 0; x < TILE; x += 2) {
    if (rand() < 0.5) px(g, x, h, 2, 1, col)
  }
}

function drawGrass(g, n, rand) {
  const h = ledgeHeight(n, 'g')
  const covered = GROUNDISH.has(n.up) || n.up === 'g'
  px(g, 0, 0, TILE, h, '#2e2119')
  speckle(g, rand, 0, 0, TILE, h, ['#1f160f', '#3d2c20', '#271b13'], 14)
  if (!covered) {
    px(g, 0, 0, TILE, 3, '#2f3d27')
    px(g, 0, 3, TILE, 1, '#1b2416')
    for (let x = 0; x < TILE; x++) {
      if (rand() < 0.4)
        px(
          g,
          x,
          -1 - Math.floor(rand() * 3),
          1,
          2 + Math.floor(rand() * 2),
          rand() < 0.5 ? '#4a5a3a' : '#5d6650',
        )
      if (rand() < 0.3) px(g, x, 3, 1, 1 + Math.floor(rand() * 2), '#26301f')
    }
  }
  raggedUnderside(g, rand, h, '#1f160f')
}

function drawMud(g, n, rand) {
  const h = ledgeHeight(n, 'm')
  px(g, 0, 0, TILE, h, '#2a1d14')
  speckle(g, rand, 0, 0, TILE, h, ['#1a110b', '#3a2a1d', '#22170f'], 18)
  if (!(GROUNDISH.has(n.up) || n.up === 'm')) {
    px(g, 0, 0, TILE, 2, '#3e2e20')
    px(g, 2 + Math.floor(rand() * 10), 0, 2, 1, '#5a6070')
    for (let x = 1; x < TILE; x += 4 + Math.floor(rand() * 3))
      px(g, x, 2, 2, 1, '#120c08')
  }
  raggedUnderside(g, rand, h, '#1a110b')
}

function drawSand(g, n, rand) {
  const h = ledgeHeight(n, 's')
  px(g, 0, 0, TILE, h, '#6e6450')
  speckle(g, rand, 0, 0, TILE, h, ['#5a5040', '#827660', '#4c4436'], 22)
  if (!(GROUNDISH.has(n.up) || n.up === 's')) px(g, 0, 0, TILE, 1, '#948a72')
  raggedUnderside(g, rand, h, '#4c4436')
}

function drawSwamp(g, n, rand) {
  const h = ledgeHeight(n, 'w')
  px(g, 0, 0, TILE, h, '#1e2416')
  speckle(g, rand, 0, 0, TILE, h, ['#141a0e', '#2a3220', '#232b18'], 18)
  if (!(GROUNDISH.has(n.up) || n.up === 'w')) {
    px(g, 0, 0, TILE, 3, '#2e3a22')
    for (let x = 0; x < TILE; x += 3)
      if (rand() < 0.6) px(g, x, 1, 2, 1, '#3e4c2c')
    if (rand() < 0.7) px(g, 3 + Math.floor(rand() * 9), -4, 1, 4, '#3a3420') // dead reed
    if (rand() < 0.5) px(g, 2 + Math.floor(rand() * 10), 0, 2, 1, '#6a7a52') // bubble
  }
  raggedUnderside(g, rand, h, '#141a0e')
}

function drawDirt(g, n, rand) {
  px(g, 0, 0, TILE, TILE, '#261b13')
  speckle(g, rand, 0, 0, TILE, TILE, ['#1a120c', '#33251a', '#20160f'], 26)
  for (let i = 0; i < 2; i++) {
    const x = 2 + Math.floor(rand() * 11),
      y = 2 + Math.floor(rand() * 11)
    const bone = rand() < 0.15
    px(g, x, y, bone ? 3 : 2, bone ? 1 : 2, bone ? '#a49a84' : '#4a4640')
    if (!bone) px(g, x, y + 1, 2, 1, '#34312c')
  }
  if (!GROUNDISH.has(n.up)) px(g, 0, 0, TILE, 1, '#3a2a1d')
}

function drawWater(g, n, rand, anim) {
  px(g, 0, 0, TILE, TILE, '#0c1620')
  for (let y = 4; y < TILE; y += 4) {
    const off = (anim * 2 + y) % 8
    for (let x = -8; x < TILE; x += 8) px(g, x + off, y, 3, 1, '#16283a')
  }
  if (n.up !== '~') {
    px(g, 0, 0, TILE, 2, '#1c3246')
    for (let x = 0; x < TILE; x++) {
      const y = Math.round(Math.sin((x + anim * 4) / 2.5))
      px(g, x, y, 1, 1, '#5a7894')
    }
  }
}

function drawGreyWater(g, n, rand, anim) {
  px(g, 0, 0, TILE, TILE, '#3a3c40')
  for (let y = 3; y < TILE; y += 5) {
    const off = (anim + y) % 8
    for (let x = -8; x < TILE; x += 8) px(g, x + off, y, 4, 1, '#46494e')
  }
  if (n.up !== 'l') {
    px(g, 0, 0, TILE, 2, '#6a6e74')
    for (let x = 0; x < TILE; x++)
      if ((x + anim) % 5 === 0) px(g, x, 0, 1, 1, '#a8acb2')
    g.globalAlpha = 0.25
    for (let i = 0; i < 3; i++)
      px(g, ((i * 6 + anim * 2) % 20) - 2, -3 - i, 5, 2, '#b8bcc4')
    g.globalAlpha = 1
  }
}

function drawWood(g, n, rand) {
  px(g, 0, 0, TILE, 5, '#4a3a2a')
  px(g, 0, 0, TILE, 1, '#625040')
  px(g, 0, 4, TILE, 1, '#241a12')
  const seam = 4 + Math.floor(rand() * 8)
  px(g, seam, 0, 1, 4, '#241a12')
  speckle(g, rand, 0, 1, TILE, 3, ['#3a2c1f', '#564434'], 5)
  px(g, seam - 2, 2, 1, 1, '#7a4a2a')
  px(g, 2, 5, 2, 3, '#2e2218')
  px(g, 12, 5, 2, 2, '#2e2218')
}

function drawLadder(g, n) {
  px(g, 2, 0, 2, TILE, '#3e2e20')
  px(g, 12, 0, 2, TILE, '#3e2e20')
  px(g, 2, 0, 1, TILE, '#56422e')
  px(g, 12, 0, 1, TILE, '#56422e')
  for (let y = 2; y < TILE; y += 5) {
    px(g, 4, y, 8, 2, '#4a3828')
    px(g, 4, y, 8, 1, '#5e4a36')
  }
  if (n.up !== 'H') {
    px(g, 2, -2, 2, 2, '#3e2e20')
    px(g, 12, -2, 2, 2, '#3e2e20')
  }
}

function drawTree(g, n, rand) {
  px(g, 5, 0, 5, TILE, '#2a2118')
  px(g, 5, 0, 1, TILE, '#3c3024')
  px(g, 9, 0, 1, TILE, '#17110c')
  px(g, 7, 3 + Math.floor(rand() * 8), 1, 2, '#120d09') // knot
  if (n.down !== 'T') {
    px(g, 3, 13, 9, 3, '#2a2118')
    px(g, 2, 15, 12, 1, '#17110c')
  }
  if (n.up !== 'T') {
    g.strokeStyle = '#2a2118'
    g.lineCap = 'round'
    const limbs = [
      [7, 3, -10, -9, 2],
      [8, 3, 11, -8, 2],
      [7, 2, -3, -11, 1.5],
      [8, 2, 4, -11, 1.5],
      [6, 3, -11, -1, 1.5],
      [9, 3, 12, 0, 1.5],
    ]
    for (const [x, y, dx, dy, w] of limbs) {
      g.lineWidth = w
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + dx, y + dy)
      g.stroke()
      g.lineWidth = 1
      const tx = x + dx * 0.65,
        ty = y + dy * 0.65
      g.beginPath()
      g.moveTo(tx, ty)
      g.lineTo(
        tx + (dx > 0 ? 3 : -3) + (rand() - 0.5) * 2,
        ty - 3 - rand() * 2,
      )
      g.stroke()
      g.beginPath()
      g.moveTo(x + dx, y + dy)
      g.lineTo(x + dx + (dx > 0 ? 2 : -2), y + dy - 2)
      g.stroke()
    }
    for (let x = -4; x < 20; x++) {
      const t = 1 + (Math.abs(x - 7) < 4 ? 1 : 0) + (rand() < 0.25 ? 1 : 0)
      px(g, x, 2 - (t > 2 ? 1 : 0), 1, t, '#2a2118')
    }
    px(g, -4, 2, 24, 1, '#3c3024')
  }
}

function drawStone(g, n, rand) {
  px(g, 0, 0, TILE, TILE, '#4a4844')
  px(g, 0, 7, TILE, 1, '#22211f')
  px(g, 0, 15, TILE, 1, '#22211f')
  px(g, 5, 0, 1, 7, '#22211f')
  px(g, 11, 8, 1, 7, '#22211f')
  px(g, 0, 0, TILE, 1, '#5e5c56')
  px(g, 0, 8, TILE, 1, '#58564f')
  speckle(g, rand, 0, 0, TILE, TILE, ['#3e3c38', '#55524c'], 12)
  if (rand() < 0.6) px(g, Math.floor(rand() * 12), 7, 3, 1, '#2e3a24')
}

function disc(g, cx, cy, r, col) {
  g.fillStyle = col
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y))
    g.fillRect(cx - w, cy + y, w * 2 + 1, 1)
  }
}
