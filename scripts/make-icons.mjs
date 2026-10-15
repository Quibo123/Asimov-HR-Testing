import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const table = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = buf => {
  let c = 0xffffffff
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// Orange square, white clock face. Everything sits inside the "safe zone" so it also works as a maskable icon.
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const c = size / 2
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c
      const dy = y + 0.5 - c
      const d = Math.hypot(dx, dy)
      const ring = d > size * 0.27 && d < size * 0.33
      const minute = Math.abs(dx) < size * 0.02 && dy < 0 && dy > -size * 0.2
      const hour = Math.abs(dy) < size * 0.02 && dx > 0 && dx < size * 0.14
      const white = ring || minute || hour
      const i = row + 1 + x * 4
      raw[i] = white ? 255 : 249
      raw[i + 1] = white ? 255 : 94
      raw[i + 2] = white ? 255 : 14
      raw[i + 3] = 255
    }
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(size, 0)
  head.writeUInt32BE(size, 4)
  head.set([8, 6, 0, 0, 0], 8) // 8 bit, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
for (const [name, size] of [['pwa-192x192.png', 192], ['pwa-512x512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/${name}`, png(size))
  console.log('wrote public/' + name)
}