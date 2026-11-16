const base = import.meta.env.BASE_URL

export async function loadSheet(name) {
  const meta = await (await fetch(`${base}sprites/${name}.json`)).json()
  const img = new Image()
  img.src = `${base}sprites/${meta.image}`
  await img.decode()
  return { img, meta }
}

export async function loadAllSprites() {
  const names = ['sally', 'skeleton', 'charon', 'shade', 'cerberus']
  const sheets = await Promise.all(names.map(loadSheet))
  return Object.fromEntries(names.map((n, i) => [n, sheets[i]]))
}

export function frameAt(sheet, anim, t) {
  const a = sheet.meta.animations[anim]
  const i = Math.floor((t / 60) * a.fps)
  return a.loop ? i % a.frames : Math.min(i, a.frames - 1)
}

export function drawSprite(ctx, sheet, anim, frame, x, y, flip = false) {
  const { frameWidth: fw, frameHeight: fh, animations } = sheet.meta
  const a = animations[anim]
  const f = Math.max(0, Math.min(frame, a.frames - 1))
  const dx = Math.round(x - fw / 2)
  const dy = Math.round(y - fh)
  if (flip) {
    ctx.save()
    ctx.translate(dx + fw, dy)
    ctx.scale(-1, 1)
    ctx.drawImage(sheet.img, f * fw, a.row * fh, fw, fh, 0, 0, fw, fh)
    ctx.restore()
  } else {
    ctx.drawImage(sheet.img, f * fw, a.row * fh, fw, fh, dx, dy, fw, fh)
  }
}
