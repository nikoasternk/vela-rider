export const VIEW_W = 200
export const VIEW_H = 300
export const CHART_POINTS = 11
export const POINT_STEP = 20
export const BIKE_SCREEN_X = 50
export const SECTION_LENGTH = 850

export const RAINBOW_COLORS = [
  '#FF1844',
  '#FF7800',
  '#FFE600',
  '#00F564',
  '#00E6FF',
  '#2D69FF',
  '#B92DFF'
]

const RAINBOW_RGB = [
  [255, 24, 68],
  [255, 120, 0],
  [255, 230, 0],
  [0, 245, 100],
  [0, 230, 255],
  [45, 105, 255],
  [185, 45, 255]
]

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v
}

function normalizeAngle(a) {
  let r = a % 6.283185307179586
  if (r > 3.141592653589793) r -= 6.283185307179586
  if (r < -3.141592653589793) r += 6.283185307179586
  return r
}

function toHexByte(n) {
  const v = clamp(n | 0, 0, 255)
  return (v < 16 ? '0' : '') + v.toString(16).toUpperCase()
}

export function computeRainbowTrackColor(worldX) {
  const uTotal = Math.max(0, worldX) / SECTION_LENGTH
  const sectionInt = uTotal | 0
  const idx = sectionInt % 7
  const localU = uTotal - sectionInt
  if (localU <= 0.84) {
    return RAINBOW_COLORS[idx]
  }
  const t = clamp((localU - 0.84) / 0.16, 0, 1)
  const s = t * t * (3 - 2 * t)
  const c0 = RAINBOW_RGB[idx]
  const c1 = RAINBOW_RGB[(idx + 1) % 7]
  const r = c0[0] + (c1[0] - c0[0]) * s
  const g = c0[1] + (c1[1] - c0[1]) * s
  const b = c0[2] + (c1[2] - c0[2]) * s
  return '#' + toHexByte(r) + toHexByte(g) + toHexByte(b)
}

export function createGameEngine(initialSeed = 20261110) {
  let rngState = initialSeed >>> 0

  function nextRand() {
    rngState ^= rngState << 13
    rngState ^= rngState >>> 17
    rngState ^= rngState << 5
    return (rngState >>> 0) / 4294967296
  }

  const chartData = new Array(CHART_POINTS)
  for (let i = 0; i < CHART_POINTS; i++) {
    chartData[i] = 140
  }

  const state = {
    status: 'menu',
    crashReason: 'РАЗБИЛСЯ!',
    score: 0,
    bestScore: 0,
    gems: 0,
    combo: 1,
    bannerText: 'УДЕРЖИВАЙ ЭКРАН',
    bannerTimer: 0,
    trackColor: RAINBOW_COLORS[0],
    sawColor: '#FF1744',
    turboFlip: false,
    farCam: false,
    camX: 0,
    camY: 0,
    segs: [],
    loops: [],
    lastX: 0,
    lastY: 180,
    lastM: 0,
    worldGems: [],
    hazards: [],
    bike: {
      x: 50,
      y: 174,
      vx: 95,
      vy: 0,
      speed: 95,
      angle: 0,
      angVel: 0,
      onGround: true,
      inLoop: false,
      activeLoop: null,
      loopAngle: 0,
      airTime: 0,
      airRotation: 0,
      airFlips: 0,
      rx: 34,
      ry: 168,
      cx: 44,
      cy: 164,
      fx: 54,
      fy: 168
    },
    gemX: -40,
    gemY: -40,
    hazX: -50,
    hazY: -50,
    loopX: -140,
    loopY: -140,
    chartData
  }

  function addSegment(dx, nextM, isKicker, isAbyss, lipY, isIsland) {
    const x0 = state.lastX
    const y0 = state.lastY
    const m0 = state.lastM
    const x1 = x0 + dx
    const y1 = y0 + dx * 0.5 * (m0 + nextM)
    const c1 = dx * m0
    const c2 = dx * 0.5 * (nextM - m0)
    state.segs.push({
      x0,
      x1,
      y0,
      y1,
      m0,
      m1: nextM,
      dm: nextM - m0,
      invDx: 1.0 / dx,
      c1,
      c2,
      kicker: Boolean(isKicker),
      abyss: Boolean(isAbyss),
      island: Boolean(isIsland),
      lipY: lipY !== undefined ? lipY : y0
    })
    state.lastX = x1
    state.lastY = y1
    state.
