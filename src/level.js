import { COLS, ROWS } from './config.js'
import { EMPTY, TILE_BY_CODE } from './tiles.js'

export const ENTITY_TYPES = [
  {
    type: 'spawn',
    name: 'Sally start',
    unique: true,
    hint: 'Where Sally begins',
  },
  {
    type: 'exit',
    name: 'Exit portal',
    unique: true,
    hint: 'Opens once every relic is collected (2x2)',
  },
  {
    type: 'relic',
    name: 'Relic',
    unique: false,
    hint: 'Collect them all to open the exit',
  },
  {
    type: 'skeleton',
    name: 'Skeleton',
    unique: false,
    hint: 'Patrols left/right. Click again to flip direction',
  },
]

export function blankLevel(name = 'Untitled') {
  const tiles = []
  for (let r = 0; r < ROWS; r++) {
    tiles.push(r === ROWS - 1 ? 'd'.repeat(COLS) : EMPTY.repeat(COLS))
  }
  return {
    name,
    tiles,
    entities: [
      { type: 'spawn', c: 2, r: ROWS - 2 },
      { type: 'exit', c: COLS - 4, r: ROWS - 2 },
    ],
  }
}

export function normaliseLevel(raw) {
  const lvl = { name: raw?.name || 'Untitled', tiles: [], entities: [] }
  for (let r = 0; r < ROWS; r++) {
    let row = (raw?.tiles?.[r] ?? '').slice(0, COLS).padEnd(COLS, EMPTY)
    row = [...row].map((ch) => (TILE_BY_CODE[ch] ? ch : EMPTY)).join('')
    lvl.tiles.push(row)
  }
  for (const e of raw?.entities ?? []) {
    if (ENTITY_TYPES.some((t) => t.type === e.type) && inBounds(e.c, e.r)) {
      lvl.entities.push({ ...e })
    }
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

export function validateLevel(level) {
  const problems = []
  if (!level.entities.some((e) => e.type === 'spawn'))
    problems.push('No start placed for Sally')
  if (!level.entities.some((e) => e.type === 'exit'))
    problems.push('No exit portal placed')
  if (!level.entities.some((e) => e.type === 'relic'))
    problems.push('No relics – the exit will be open from the start')
  return problems
}
