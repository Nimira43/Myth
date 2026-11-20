let ctx = null

export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    ctx = null
  }
}

export function thunder(volume = 0.6) {
  if (!ctx || ctx.state !== 'running') return
  const dur = 3 + Math.random() * 2
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  const swells = [0, 0.3 + Math.random() * 0.4, 1 + Math.random()]
  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    let env = 0
    for (const s of swells)
      env +=
        t > s
          ? Math.exp(-(t - s) * 1.6) * (t - s < 0.05 ? (t - s) / 0.05 : 1)
          : 0
    data[i] = last * env * 3.5
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 300 + Math.random() * 300
  const gain = ctx.createGain()
  gain.gain.value = volume
  src.connect(lp).connect(gain).connect(ctx.destination)
  src.start()
}

const DORIAN = [
  146.83, 164.81, 174.61, 196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 349.23,
]

export function pluck(freq, volume = 0.18) {
  if (!ctx || ctx.state !== 'running') return
  const rate = ctx.sampleRate
  const len = Math.floor(rate * 2.2)
  const buf = ctx.createBuffer(1, len, rate)
  const data = buf.getChannelData(0)
  const period = Math.max(2, Math.round(rate / freq))
  const line = new Float32Array(period)
  for (let i = 0; i < period; i++) line[i] = Math.random() * 2 - 1
  let idx = 0
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % period
    const v = (line[idx] + line[next]) * 0.4985
    data[i] = line[idx]
    line[idx] = v
    idx = next
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2400
  const gain = ctx.createGain()
  gain.gain.value = volume
  src.connect(lp).connect(gain).connect(ctx.destination)
  src.start()
}

export function lyrePhrase(volume = 0.16) {
  if (!ctx || ctx.state !== 'running') return
  const start = Math.floor(Math.random() * 4)
  const steps = [0, 2, 4, Math.random() < 0.5 ? 3 : 5]
  steps.forEach((s, i) =>
    setTimeout(
      () =>
        pluck(
          DORIAN[Math.min(DORIAN.length - 1, start + s)],
          volume * (1 - i * 0.12),
        ),
      i * 420,
    ),
  )
}

export function lyreLament(volume = 0.2) {
  if (!ctx || ctx.state !== 'running') return
  [7, 5, 4, 2, 0].forEach((n, i) =>
    setTimeout(() => pluck(DORIAN[n], volume), i * 300),
  )
}
