// Genera los iconos PNG de la app (bandeja y ventana) sin dependencias:
// dibuja la cara del robot con formas simples y supermuestreo para suavizar bordes.
// Uso: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SS = 4 // supermuestreo 4x4

/** Distancia con signo a un rectángulo redondeado centrado en (cx, cy). */
function roundRect(px, py, cx, cy, w, h, r) {
  const qx = Math.abs(px - cx) - w / 2 + r
  const qy = Math.abs(py - cy) - h / 2 + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** Color en un punto de un lienzo 0..1 (null = transparente). */
function shade(x, y) {
  const eye = (cx) => roundRect(x, y, cx, 0.53, 0.1, 0.16, 0.05) <= 0
  if (eye(0.39) || eye(0.61)) return [126, 240, 255]
  if (roundRect(x, y, 0.5, 0.53, 0.62, 0.44, 0.2) <= 0) {
    const t = (y - 0.31) / 0.44
    return [34 - 20 * t, 40 - 25 * t, 57 - 33 * t]
  }
  if (roundRect(x, y, 0.5, 0.53, 0.86, 0.82, 0.38) <= 0) {
    const t = (y - 0.12) / 0.82
    return [255 - 40 * t, 255 - 35 * t, 255 - 25 * t]
  }
  if (Math.hypot(x - 0.5, y - 0.07) <= 0.06) return [230, 234, 242]
  if (Math.abs(x - 0.5) < 0.018 && y > 0.07 && y < 0.14) return [200, 206, 218]
  return null
}

function render(size) {
  const px = Buffer.alloc(size * size * 4)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((i + (sx + 0.5) / SS) / size, (j + (sy + 0.5) / SS) / size)
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++ }
        }
      }
      const o = (j * size + i) * 4
      if (a) {
        px[o] = Math.round(r / a)
        px[o + 1] = Math.round(g / a)
        px[o + 2] = Math.round(b / a)
        px[o + 3] = Math.round((a / (SS * SS)) * 255)
      }
    }
  }
  return encodePng(size, px)
}

// --- Codificador PNG mínimo (RGBA de 8 bits) ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const outputs = { 'tray.png': 16, 'tray@2x.png': 32, 'icon.png': 256 }
for (const [file, size] of Object.entries(outputs)) {
  const path = join(root, 'assets', file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, render(size))
  console.log(`assets/${file} (${size}x${size})`)
}
