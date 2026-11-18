import { COLS, ROWS } from './config.js'
import { EMPTY, TILE_BY_CODE } from './tiles.js'

export const SETTINGS = [
  { id: 'storm', name: 'Outdoors – storm' },
  { id: 'underworld', name: 'Underworld' },
  { id: 'labyrinth', name: 'Labyrinth – torchlit, with Ariadne\u2019s thread' },
]

export const ENTITY_TYPES = [
  {
    type: 'spawn',
    group: 'Set pieces',
    name: 'Sally start',
    unique: true,
    size: [1, 2],
    hint: 'Where Sally begins',
  },
  {
    type: 'exit',
    group: 'Set pieces',
    name: 'Exit',
    unique: true,
    size: [2, 2],
    toggle: 'style',
    hint: 'Opens when the level is solved. Click again to cycle: temple / bronze gates / Minoan doorway',
  },
  {
    type: 'thrones',
    group: 'Set pieces',
    name: 'Thrones',
    unique: true,
    size: [3, 2],
    hint: 'Hades and Persephone. Bring every seed here to unseal the exit',
  },
  {
    type: 'ferry',
    group: 'Set pieces',
    name: "Charon's ferry",
    unique: false,
    size: [3, 1],
    hint: 'Place just above water. Costs one obol per crossing',
  },
  {
    type: 'torch',
    group: 'Set pieces',
    name: 'Torch',
    unique: false,
    size: [1, 1],
    hint: 'A wall torch: lights the dark in torchlit (Labyrinth) levels',
  },
  {
    type: 'relic',
    group: 'Collectables',
    name: 'Relic',
    unique: false,
    size: [1, 1],
    hint: 'Collect them all to open the exit',
  },
  {
    type: 'seed',
    group: 'Collectables',
    name: 'Pomegranate seed',
    unique: false,
    size: [1, 1],
    hint: 'Offer them all at the thrones (or just collect them if there are no thrones)',
  },
  {
    type: 'obol',
    group: 'Collectables',
    name: 'Obol',
    unique: false,
    size: [1, 1],
    hint: "Silver coin: Charon's fare",
  },
  {
    type: 'labrys',
    group: 'Collectables',
    name: 'Labrys',
    unique: false,
    size: [1, 1],
    hint: 'The bronze double axe of Knossos. Collect them all to open the exit',
  },
  {
    type: 'skeleton',
    group: 'Guardians',
    name: 'Skeleton',
    unique: false,
    size: [1, 2],
    toggle: 'dir',
    hint: 'Patrols left/right. Click again to flip direction',
  },
  {
    type: 'shade',
    group: 'Guardians',
    name: 'Shade',
    unique: false,
    size: [1, 2],
    toggle: 'dir',
    hint: 'Drifts up/down through platforms, turning at solid tiles. Click again to flip',
  },
  {
    type: 'cerberus',
    group: 'Guardians',
    name: 'Cerberus',
    unique: false,
    size: [2, 2],
    toggle: 'dir',
    hint: 'Chained. Lunges only when Sally heads for the exit, then rests. Click again to face the other way',
  },
  {
    type: 'minotaur',
    group: 'Guardians',
    name: 'Minotaur',
    unique: false,
    size: [2, 2],
    toggle: 'dir',
    hint: 'Patrols his floor. Spots Sally ahead, paws the ground, charges, and stuns himself on walls. Tramples Ariadne\u2019s thread',
  },
]

export const entityDef = (type) => ENTITY_TYPES.find((t) => t.type === type)

export function footprint(en) {
  const [w, h] = entityDef(en.type)?.size ?? [1, 1]
  return { c0: en.c, c1: en.c + w - 1, r0: en.r - h + 1, r1: en.r }
}

export function blankLevel(name = 'Untitled') {
  const tiles = []
  for (let r = 0; r < ROWS; r++) {
    tiles.push(r === ROWS - 1 ? 'd'.repeat(COLS) : EMPTY.repeat(COLS))
  }
  return {
    name,
    setting: 'storm',
    intro: '',
    tiles,
    entities: [
      { type: 'spawn', c: 2, r: ROWS - 2 },
      { type: 'exit', c: COLS - 4, r: ROWS - 2 },
    ],
  }
}

export function normaliseLevel(raw) {
  const lvl = {
    name: raw?.name || 'Untitled',
    setting: SETTINGS.some((s) => s.id === raw?.setting)
      ? raw.setting
      : 'storm',
    intro: typeof raw?.intro === 'string' ? raw.intro : '',
    tiles: [],
    entities: [],
  }
  for (let r = 0; r < ROWS; r++) {
    let row = (raw?.tiles?.[r] ?? '').slice(0, COLS).padEnd(COLS, EMPTY)
    row = [...row].map((ch) => (TILE_BY_CODE[ch] ? ch : EMPTY)).join('')
    lvl.tiles.push(row)
  }
  for (const e of raw?.entities ?? []) {
    if (entityDef(e.type) && inBounds(e.c, e.r)) lvl.entities.push({ ...e })
  }
  return lvl
}

export const inBounds = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS

export function getTile(level, c, r) {
  return inBounds(c, r) ? level.tiles[r][c] : EMPTY
}

export function setTile(level, c, r, code) {
  if (!inBounds(c, r)) return false
  const row = level.tiles[r]
  if (row[c] === code) return false
  level.tiles[r] = row.slice(0, c) + code + row.slice(c + 1)
  return true
}

export function cloneLevel(level) {
  return JSON.parse(JSON.stringify(level))
}

const isWater = (code) =>
  TILE_BY_CODE[code]?.behaviour === 'hazard' && (code === '~' || code === 'l')

export function ferryRoute(level, en) {
  const r = en.r + 1
  if (!isWater(getTile(level, en.c, r))) return null
  let a = en.c,
    b = en.c
  while (isWater(getTile(level, a - 1, r))) a--
  while (isWater(getTile(level, b + 1, r))) b++
  if (b - a + 1 < 3) return null
  return [a, b - 2]
}

export function validateLevel(level) {
  const problems = []
  const count = (type) => level.entities.filter((e) => e.type === type).length
  if (!count('spawn')) problems.push('No start placed for Sally')
  if (!count('exit')) problems.push('No exit placed')
  if (count('thrones') && !count('seed'))
    problems.push('Thrones but no seeds to offer')
  for (const f of level.entities.filter((e) => e.type === 'ferry')) {
    if (!ferryRoute(level, f))
      problems.push(`Ferry at ${f.c},${f.r} isn't sitting just above water`)
  }
  if (count('ferry') && !count('obol'))
    problems.push('A ferry but no obols to pay Charon')
  if (!count('relic') && !count('seed') && !count('labrys'))
    problems.push('Nothing to collect – the exit starts open')
  if (level.setting === 'labyrinth' && !count('torch'))
    problems.push(
      'Torchlit level with no torches: only Sally\u2019s own light',
    )
  return problems
}
