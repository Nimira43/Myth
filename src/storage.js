import { ZONES } from './zones.js'
import { normaliseLevel, blankLevel } from './level.js'
import starter from './levels/starter.json'

const KEY = 'myth.project.v1'

export function normaliseProject(raw) {
  const project = { version: 1, starterVersion: raw?.starterVersion ?? 1, zones: {} }
  for (const z of ZONES) {
    const levels = raw?.zones?.[z.id]
    project.zones[z.id] = Array.isArray(levels) && levels.length
      ? levels.map(normaliseLevel)
      : [blankLevel(`${z.name} 1`)]
  }
  return project
}

function mergeNewStarterLevels(project) {
  const target = starter.starterVersion ?? 1
  if ((project.starterVersion ?? 1) >= target) return project
  for (const [zoneId, levels] of Object.entries(starter.zones ?? {})) {
    const mine = project.zones[zoneId]
    if (!mine) continue
    levels.forEach((lvl, i) => {
      if (!mine.some((m) => m.name === lvl.name)) mine.splice(Math.min(i, mine.length), 0, normaliseLevel(lvl))
    })
  }
  project.starterVersion = target
  return project
}

export function loadProject() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return mergeNewStarterLevels(normaliseProject(JSON.parse(saved)))
  } catch (err) {
    console.warn('Could not read saved project, using starter levels', err)
  }
  return normaliseProject(starter)
}

export function saveProject(project) {
  try {
    localStorage.setItem(KEY, JSON.stringify(project))
    return true
  } catch (err) {
    console.error('Save failed', err)
    return false
  }
}

export function resetProject() {
  localStorage.removeItem(KEY)
  return normaliseProject(starter)
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function pickJSONFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      try {
        const text = await input.files[0].text()
        resolve(JSON.parse(text))
      } catch (err) {
        reject(err)
      }
    }
    input.click()
  })
}
