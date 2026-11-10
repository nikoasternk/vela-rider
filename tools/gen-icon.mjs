import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const width = 192
const height = 192
const raw = Buffer.alloc(height * (1 + width * 4), 0)

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= width || y < 0 || y >= height) return
  const rowOffset = y * (1 + width * 4)
  const idx = rowOffset + 1 + x * 4
  raw[idx] = r
  raw[idx + 1] = g
  raw[idx + 2] = b
  raw[idx + 3] = a
}

function drawCircleRing(cx, cy, rOuter, rInner, r, g, b) {
  const rOut2 = rOuter * rOuter
  const rIn2 = rInner * rInner
  for (let y = Math.floor(cy - rOuter); y <= Math.ceil(cy + rOuter); y++) {
    for (let x = Math.floor(cx - rOuter); x <= Math.ceil(cx + rOuter); x++) {
      const dx = x - cx
      const dy = y - cy
      const d2 = dx * dx + dy * dy
      if (d2 <= rOut2 && d2 >= rIn2) {
        setPixel(x, y, r, g, b, 255)
      }
    }
  }
}

function drawThickLine(x0, y0, x1, y1, radius, r, g, b) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t
    drawCircleRing(x, y, radius, 0, r, g, b)
  }
}

for (let y = 0; y < height; y++) {
  raw[y * (1 + width * 4)] = 0
  for (let x = 0; x < width; x++) {
    const dx = x - 96
    const dy = y - 96
    if (dx * dx + dy * dy <= 90 * 90) {
      setPixel(x, y, 8, 12, 24, 255)
    }
  }
}

drawCircleRing(96, 96, 90, 84, 0, 240, 255)
drawThickLine(22, 146, 170, 114, 4, 255, 0, 85)
drawCircleRing(58, 112, 20, 12, 0, 240, 255)
drawCircleRing(134, 96, 20, 12, 0, 240, 255)
drawThickLine(58, 112, 94, 82, 5, 0, 240, 255)
drawThickLine(94, 82, 134, 96, 5, 0, 240, 255)
drawThickLine(58, 112, 134, 96, 4, 255, 0, 85)
drawCircleRing(92, 66, 10, 0, 255, 215, 0)

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  const combined = Buffer.concat([typeBuf, data])
  crcBuf.writeUInt32BE(crc32(combined), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(width, 0)
ihdr.writeUInt32BE(height, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const idatData = zlib.deflateSync(raw, { level: 9 })
const png = Buffer.concat([
  signature,
  makeChunk('IHDR', ihdr),
  makeChunk('IDAT', idatData),
  makeChunk('IEND', Buffer.alloc(0))
])

const outDir = path.resolve('src/common')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'logo.png'), png)
