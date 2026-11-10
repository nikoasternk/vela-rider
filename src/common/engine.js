export const VIEW_W = 208
export const VIEW_H = 280
export const CHART_POINTS = 17
export const POINT_STEP = 13
export const BIKE_SCREEN_X = 52

const SPECTRUM = [
  [0, 240, 255],
  [130, 50, 255],
  [255, 0, 110],
  [255, 90, 0],
  [255, 215, 0],
  [0, 255, 140]
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

function interpolateSpectrum(phase, scale) {
  const len = SPECTRUM.length
  const p = ((phase % 1) + 1) % 1
  const scaled = p * len
  const idx = scaled | 0
  const frac = scaled - idx
  const c0 = SPECTRUM[idx % len]
  const c1 = SPECTRUM[(idx + 1) % len]
  const r = (c0[0] + (c1[0] - c0[0]) * frac) * scale
  const g = (c0[1] + (c1[1] - c0[1]) * frac) * scale
  const b = (c0[2] + (c1[2] - c0[2]) * frac) * scale
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
    chartData[i] = 130
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
    trackColor: '#00F0FF',
    fillColor: '#042230',
    turboFlip: false,
    camY: 0,
    segs: [],
    lastX: 0,
    lastY: 160,
    lastM: 0,
    worldGems: [],
    hazards: [],
    bike: {
      x: 52,
      y: 154,
      vx: 115,
      vy: 0,
      speed: 115,
      angle: 0,
      angVel: 0,
      onGround: true,
      airTime: 0,
      airRotation: 0,
      airFlips: 0,
      rx: 42,
      ry: 148,
      cx: 46,
      cy: 149,
      fx: 56,
      fy: 148,
      vxVisor: 48,
      vyVisor: 140
    },
    gemX: -30,
    gemY: -30,
    hazX: -30,
    hazY: -30,
    chartData
  }

  function addSegment(dx, nextM, isKicker) {
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
      kicker: Boolean(isKicker)
    })
    state.lastX = x1
    state.lastY = y1
    state.lastM = nextM
  }

  function appendProceduralChunk() {
    const r = nextRand()

    if (r < 0.32) {
      const downM = 0.44 + nextRand() * 0.16
      const upM = -(0.56 + nextRand() * 0.14)
      addSegment(85, downM, false)
      addSegment(80, 0.0, false)
      addSegment(85, upM, true)
      const lipX = state.lastX
      const lipY = state.lastY
      addSegment(60, 0.48, false)
      addSegment(95, 0.28, false)
      addSegment(85, 0.0, false)
      state.worldGems.push({
        x: lipX + 62,
        y: lipY - 42,
        taken: false
      })
    } else if (r < 0.62) {
      const upM = -(0.52 + nextRand() * 0.15)
      addSegment(75, 0.25, false)
      addSegment(70, 0.0, false)
      addSegment(85, upM, true)
      const peakX = state.lastX
      const peakY = state.lastY
      addSegment(65, 0.52, false)
      addSegment(95, 0.24, false)
      addSegment(85, 0.0, false)
      state.worldGems.push({
        x: peakX + 58,
        y: peakY - 40,
        taken: false
      })
    } else if (r < 0.84) {
      addSegment(75, 0.38, false)
      addSegment(70, 0.0, false)
      addSegment(80, -0.64, true)
      const lipX = state.lastX
      const lipY = state.lastY
      addSegment(50, 0.65, false)
      const pitX = state.lastX + 18
      addSegment(45, 0.0, false)
      const pitY = state.lastY
      addSegment(65, 0.32, false)
      addSegment(85, 0.0, false)
      state.hazards.push({
        x: pitX,
        y: pitY - 8
      })
      state.worldGems.push({
        x: lipX + 56,
        y: lipY - 44,
        taken: false
      })
    } else {
      const m1 = 0.50 + nextRand() * 0.16
      const m2 = -(0.62 + nextRand() * 0.14)
      addSegment(90, m1, false)
      addSegment(85, 0.0, false)
      addSegment(90, m2, true)
      const crestX = state.lastX
      const crestY = state.lastY
      addSegment(65, 0.50, false)
      addSegment(95, 0.25, false)
      addSegment(85, 0.0, false)
      state.worldGems.push({
        x: crestX + 64,
        y: crestY - 46,
        taken: false
      })
    }
  }

  let searchHint = 0

  function sampleTerrainY(wx) {
    const segs = state.segs
    const len = segs.length
    if (searchHint >= len) searchHint = 0
    let idx = searchHint
    if (wx < segs[idx].x0) idx = 0
    for (let i = idx; i < len; i++) {
      const s = segs[i]
      if (wx <= s.x1 || i === len - 1) {
        searchHint = i
        const u = clamp((wx - s.x0) * s.invDx, 0, 1)
        return s.y0 + u * (s.c1 + u * s.c2)
      }
    }
    return state.lastY
  }

  function sampleTerrain(wx) {
    const segs = state.segs
    const len = segs.length
    if (searchHint >= len) searchHint = 0
    let idx = searchHint
    if (wx < segs[idx].x0) idx = 0
    for (let i = idx; i < len; i++) {
      const s = segs[i]
      if (wx <= s.x1 || i === len - 1) {
        searchHint = i
        const u = clamp((wx - s.x0) * s.invDx, 0, 1)
        const y = s.y0 + u * (s.c1 + u * s.c2)
        const m = s.m0 + u * s.dm
        return {
          y,
          m,
          angle: Math.atan2(m, 1),
          kicker: s.kicker && u > 0.86
        }
      }
    }
    return { y: state.lastY, m: 0, angle: 0, kicker: false }
  }

  function updateColors() {
    const phase = (state.bike.x * 0.00024 + state.score * 0.008) % 1
    state.trackColor = interpolateSpectrum(phase, 1.0)
    state.fillColor = interpolateSpectrum(phase, 0.16)
  }

  function updateProjections() {
    const b = state.bike
    const worldLeft = b.x - BIKE_SCREEN_X
    const groundAtBike = sampleTerrainY(b.x)

    const focusY = b.onGround ? b.y : b.y * 0.62 + groundAtBike * 0.38
    const targetCamY = focusY - 146
    state.camY += (targetCamY - state.camY) * 0.24
    const camY = state.camY

    for (let i = 0; i < CHART_POINTS; i++) {
      const sy = sampleTerrainY(worldLeft + i * POINT_STEP) - camY
      chartData[i] = clamp(Math.round(VIEW_H - sy), 6, VIEW_H - 6)
    }

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const sx = BIKE_SCREEN_X
    const sy = clamp(b.y - camY, 12, VIEW_H - 12)

    b.rx = Math.round(sx - cosA * 10 - 6)
    b.ry = Math.round(sy - sinA * 10 - 6)
    b.cx = Math.round(sx - 6)
    b.cy = Math.round(sy - 5)
    b.fx = Math.round(sx + cosA * 10 - 6)
    b.fy = Math.round(sy + sinA * 10 - 6)
    b.vxVisor = Math.round(sx + sinA * 8 - 4)
    b.vyVisor = Math.round(sy - cosA * 8 - 4)

    let gx = -30
    let gy = -30
    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const scX = Math.round(g.x - worldLeft - 5)
        const scY = Math.round(g.y - camY - 5)
        if (scX >= -10 && scX <= VIEW_W + 10 && scY >= 4 && scY <= VIEW_H - 10) {
          gx = scX
          gy = scY
          break
        }
      }
    }
    state.gemX = gx
    state.gemY = gy

    let hx = -30
    let hy = -30
    for (let i = 0; i < state.hazards.length; i++) {
      const h = state.hazards[i]
      const scX = Math.round(h.x - worldLeft - 6)
      const scY = Math.round(h.y - camY - 6)
      if (scX >= -10 && scX <= VIEW_W + 10 && scY >= 4 && scY <= VIEW_H - 10) {
        hx = scX
        hy = scY
        break
      }
    }
    state.hazX = hx
    state.hazY = hy
  }

  function resetWorld() {
    state.segs = []
    state.worldGems = []
    state.hazards = []
    state.lastX = 0
    state.lastY = 160
    state.lastM = 0
    searchHint = 0

    addSegment(95, 0.0, false)
    addSegment(80, 0.42, false)
    addSegment(75, 0.0, false)
    addSegment(85, -0.58, true)
    addSegment(60, 0.48, false)
    addSegment(90, 0.24, false)
    addSegment(85, 0.0, false)
    for (let i = 0; i < 6; i++) {
      appendProceduralChunk()
    }

    const startSample = sampleTerrain(52)
    state.bike.x = 52
    state.bike.y = startSample.y - 6
    state.bike.vx = 115
    state.bike.vy = 0
    state.bike.speed = 115
    state.bike.angle = startSample.angle
    state.bike.angVel = 0
    state.bike.onGround = true
    state.bike.airTime = 0
    state.bike.airRotation = 0
    state.bike.airFlips = 0
    state.camY = state.bike.y - 146
    updateColors()
    updateProjections()
  }

  function triggerCrash(reason) {
    state.status = 'gameover'
    state.crashReason = reason
    state.bannerText = reason
    state.bannerTimer = 2.0
    if (state.score > state.bestScore) {
      state.bestScore = state.score
    }
    updateProjections()
  }

  function startGame() {
    resetWorld()
    state.status = 'playing'
    state.crashReason = ''
    state.score = 0
    state.combo = 1
    state.bannerText = 'ВПЕРЕД!'
    state.bannerTimer = 0.7
    updateProjections()
  }

  let colorTick = 0

  function step(dtInput, isPressing) {
    const dt = clamp(dtInput, 0.01, 0.045)
    let event = null

    if (state.bannerTimer > 0) {
      state.bannerTimer = Math.max(0, state.bannerTimer - dt)
      if (state.bannerTimer === 0 && state.status === 'playing') {
        state.bannerText = ''
      }
    }

    if (state.status !== 'playing') {
      updateProjections()
      return { event }
    }

    const b = state.bike
    const gravity = 520

    if (b.onGround) {
      const cur = sampleTerrain(b.x)

      if (isPressing) {
        if (b.speed < 150) {
          b.speed += 420 * dt
        }
        const uphillBoost = cur.angle < 0 ? -Math.sin(cur.angle) * 90 : 0
        const downhillBoost = cur.angle > 0 ? Math.sin(cur.angle) * 180 : 0
        b.speed += (260 + uphillBoost + downhillBoost) * dt
      } else {
        const downhillCoast = cur.angle > 0 ? Math.sin(cur.angle) * 120 : 0
        b.speed += downhillCoast * dt
        b.speed *= 1 - 0.10 * dt
      }

      b.speed = clamp(b.speed, 110, 265)

      const stepDist = b.speed * dt
      const nextX = b.x + Math.max(2.0, stepDist * Math.cos(cur.angle * 0.6))
      const next = sampleTerrain(nextX)

      const angleDrop = next.angle - cur.angle

      if (
        (cur.kicker && b.speed > 135) ||
        (angleDrop > 0.085 && b.speed > 150)
      ) {
        b.onGround = false
        b.airTime = 0
        b.airRotation = 0
        b.airFlips = 0
        const launchAngle = clamp(cur.angle, -0.68, -0.32)
        b.x = nextX
        b.vx = clamp(b.speed * Math.cos(launchAngle), 140, 215)
        b.vy = b.speed * Math.sin(launchAngle) - 34
        b.y = cur.y - 7
        b.angVel = isPressing ? -8.5 : 0
      } else {
        b.x = nextX
        b.y = next.y - 6
        b.vx = b.speed * Math.cos(next.angle)
        b.vy = b.speed * Math.sin(next.angle)
        const wheelieOffset = isPressing && b.speed > 180 ? -0.12 : 0
        b.angle = next.angle + wheelieOffset
        b.angVel = 0
      }
    } else {
      b.airTime += dt
      b.x += b.vx * dt
      b.vy += gravity * dt
      b.y += b.vy * dt

      const maxSpin = state.turboFlip ? 17.5 : 14.8
      const spinAcc = state.turboFlip ? 110.0 : 92.0

      if (isPressing) {
        b.angVel = Math.max(-maxSpin, b.angVel - spinAcc * dt)
      } else {
        b.angVel *= Math.max(0, 1 - 19.0 * dt)
      }

      const dTheta = b.angVel * dt
      b.angle = normalizeAngle(b.angle + dTheta)
      if (dTheta < 0) {
        b.airRotation += -dTheta
        const totalFlips = Math.floor((b.airRotation + 0.35) / 6.283185307179586)
        if (totalFlips > b.airFlips) {
          b.airFlips = totalFlips
          state.score += 2 * state.combo
          state.bannerText = 'САЛЬТО x' + b.airFlips
          state.bannerTimer = 0.75
          event = 'flip'
        }
      }

      const ground = sampleTerrain(b.x)
      if (b.y >= ground.y - 6 && b.vy >= -10) {
        const diff = Math.abs(normalizeAngle(b.angle - ground.angle))
        if (diff > 1.38) {
          triggerCrash('РАЗБИЛСЯ!')
          return { event: 'crash' }
        }

        b.y = ground.y - 6
        b.onGround = true
        b.angle = ground.angle
        b.angVel = 0

        const impactSpeed = Math.hypot(b.vx, b.vy)
        b.speed = clamp(Math.max(b.speed, impactSpeed * 0.88), 125, 265)

        if (b.airFlips > 0) {
          if (diff < 0.38) {
            state.combo = Math.min(5, state.combo + 1)
            const bonus = b.airFlips * 3 * state.combo
            state.score += bonus
            b.speed = Math.min(265, b.speed + 25)
            state.bannerText = 'ИДЕАЛЬНО +' + bonus
            state.bannerTimer = 0.85
          } else {
            state.combo = 1
            const bonus = b.airFlips * 2
            state.score += bonus
            state.bannerText = 'ЧИСТО +' + bonus
            state.bannerTimer = 0.75
          }
          event = 'land'
        }
        b.airTime = 0
        b.airRotation = 0
        b.airFlips = 0
      }
    }

    for (let i = 0; i < state.hazards.length; i++) {
      const h = state.hazards[i]
      const dx = h.x - b.x
      const dy = h.y - b.y
      if (dx * dx + dy * dy < 196) {
        triggerCrash('ЛАЗЕР!')
        return { event: 'crash' }
      }
    }

    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const dx = g.x - b.x
        const dy = g.y - b.y
        if (dx * dx + dy * dy < 420) {
          g.taken = true
          state.gems += 1
          state.score += 3
          state.bannerText = 'КРИСТАЛЛ +3'
          state.bannerTimer = 0.6
          if (!event) event = 'gem'
        }
      }
    }

    const distanceScore = (b.x / 90) | 0
    if (distanceScore > state.score) {
      state.score = distanceScore
    }
    if (state.score > state.bestScore) {
      state.bestScore = state.score
    }

    while (state.lastX < b.x + 420) {
      appendProceduralChunk()
    }
    while (state.segs.length > 8 && state.segs[0].x1 < b.x - 160) {
      state.segs.shift()
      if (searchHint > 0) searchHint -= 1
    }
    while (state.worldGems.length > 0 && state.worldGems[0].x < b.x - 100) {
      state.worldGems.shift()
    }
    while (state.hazards.length > 0 && state.hazards[0].x < b.x - 100) {
      state.hazards.shift()
    }

    colorTick = (colorTick + 1) & 3
    if (colorTick === 0) {
      updateColors()
    }

    updateProjections()
    return { event }
  }

  function getRenderSnapshot() {
    return {
      status: state.status,
      crashReason: state.crashReason,
      trackColor: state.trackColor,
      fillColor: state.fillColor,
      score: state.score,
      bestScore: state.bestScore,
      gems: state.gems,
      bannerText: state.bannerText,
      bike: state.bike,
      chartData: state.chartData,
      gemX: state.gemX,
      gemY: state.gemY,
      hazX: state.hazX,
      hazY: state.hazY
    }
  }

  resetWorld()

  return {
    state,
    startGame,
    step,
    getRenderSnapshot
  }
        }
