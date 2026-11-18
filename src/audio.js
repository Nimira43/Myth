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
