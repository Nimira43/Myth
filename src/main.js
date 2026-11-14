import './style.css'
import { VIEW_W, VIEW_H, HUD_H } from './config.js'
import { loadAllSprites } from './sprites.js'
import { Editor } from './editor/editor.js'
import { Game } from './game/game.js'

const canvas = document.getElementById('screen')
const ctx = canvas.getContext('2d')

let mode = 'edit'
let editor = null
let game = null
let frame = 0

function sizeCanvas() {
  const h = mode === 'play' ? VIEW_H + HUD_H : VIEW_H
  canvas.width = VIEW_W
  canvas.height = h
  ctx.imageSmoothingEnabled = false
  const stage = canvas.parentElement
  const availW = stage.clientWidth - 32
  const availH =
    window.innerHeight - document.querySelector('.topbar').offsetHeight - 70
  let scale = Math.min(availW / VIEW_W, availH / h)
  scale =
    scale >= 2 ? Math.floor(scale) : Math.max(1, Math.floor(scale * 4) / 4)
  canvas.style.width = `${VIEW_W * scale}px`
  canvas.style.height = `${h * scale}px`
}

function startPlay(level, zone) {
  game = new Game(level, zone, editor.sprites, { onExit: stopPlay })
  mode = 'play'
  document.body.classList.add('playing')
  document.getElementById('btnPlay').textContent = '■ Stop (Esc)'
  sizeCanvas()
  document.activeElement?.blur()
}

function stopPlay() {
  mode = 'edit'
  game = null
  document.body.classList.remove('playing')
  document.getElementById('btnPlay').textContent = '▶ Test Play'
  sizeCanvas()
}

const STEP = 1000 / 60
let last = performance.now()
let acc = 0

function loop(now) {
  acc += Math.min(now - last, 250)
  last = now
  while (acc >= STEP) {
    frame++
    if (mode === 'play') game.update()
    else editor.tick()
    acc -= STEP
  }
  if (mode === 'play') game.draw(ctx)
  else editor.draw(ctx, frame)
  requestAnimationFrame(loop)
}

async function boot() {
  await Promise.all([
    document.fonts.load('16px VT323'),
    document.fonts.load('16px Almendra'),
  ]).catch(() => {})
  const sprites = await loadAllSprites()
  editor = new Editor({
    sprites,
    onPlay: startPlay,
  })
  editor.bindCanvas(canvas)

  document.getElementById('btnPlay').addEventListener(
    'click',
    (e) => {
      if (mode === 'play') {
        stopPlay()
        e.stopImmediatePropagation()
      }
    },
    true,
  )
  window.addEventListener('keydown', (e) =>
    mode === 'play' ? game.keyDown(e) : editor.keyDown(e),
  )
  window.addEventListener('keyup', (e) => {
    if (mode === 'play') game.keyUp(e)
  })
  window.addEventListener('resize', sizeCanvas)

  window.myth = {
    get editor() {
      return editor
    },
    get game() {
      return game
    },
  }

  sizeCanvas()
  requestAnimationFrame(loop)
}

boot()
