export const VIEW_W = 200
export const VIEW_H = 300
export const CHART_POINTS = 11
export const POINT_STEP = 20
export const BIKE_SCREEN_X = 50

const SPECTRUM = [
  [0, 240, 255],
  [0, 140, 255],
  [157, 78, 221],
  [255, 0, 110],
  [255, 60, 0],
  [255, 195, 0],
  [0, 255, 120],
  [0, 255, 200]
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
    trackColor: '#00F0FF',
    fillColor: '#042230',
    bikeColor: '#FF006E',
    accentColor: '#FFD700',
    turboFlip: false,
    camY: 0,
    segs: [],
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
    gemX: -30,
    gemY: -30,
    hazX: -30,
    hazY: -30,
    chartData
  }

  function addSegment(dx, nextM, isKicker, isAbyss, lipY) {
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
      lipY: lipY !== undefined ? lipY : y0
    })
    state.lastX = x1
    state.lastY = y1
    state.lastM = nextM
  }

  function appendProceduralChunk() {
    const r = nextRand()

    if (r < 0.22) {
      const dropM = 0.88 + nextRand() * 0.25
      const launchM = -(0.86 + nextRand() * 0.22)
      addSegment(105, dropM, false, false, 0)
      addSegment(85, 0.0, false, false, 0)
      addSegment(95, launchM, true, false, 0)
      const lipX = state.lastX
      const lipY = state.lastY
      addSegment(55, 0.95, false, true, lipY)
      addSegment(55, 0.0, false, true, lipY)
      addSegment(70, -0.45, false, false, 0)
      addSegment(95, 0.35, false, false, 0)
      addSegment(80, 0.0, false, false, 0)
      state.worldGems.push({
        x: lipX + 68,
        y: lipY - 52,
        taken: false
      })
    } else if (r < 0.46) {
      addSegment(75, 0.55, false, false, 0)
      addSegment(65, 0.0, false, false, 0)
      addSegment(85, -0.82, true, false, 0)
      const lipX = state.lastX
      const lipY = state.lastY
      addSegment(62, 1.35, false, true, lipY)
      const pitX = state.lastX
      const pitY = state.lastY
      addSegment(62, -1.15, false, true, lipY)
      addSegment(75, 0.42, false, false, 0)
      addSegment(85, 0.0, false, false, 0)
      state.hazards.push({
        x: pitX,
        y: pitY - 10
      })
      state.worldGems.push({
        x: lipX + 62,
        y: lipY - 48,
        taken: false
      })
    } else if (r < 0.68) {
      addSegment(85, 0.85, false, false, 0)
      addSegment(70, 0.0, false, false, 0)
      addSegment(85, -0.85, true, false, 0)
      const w1X = state.lastX
      const w1Y = state.lastY
      addSegment(75, 0.88, false, false, 0)
      addSegment(70, 0.0, false, false, 0)
      addSegment(85, -0.78, true, false, 0)
      addSegment(80, 0.45, false, false, 0)
      addSegment(75, 0.0, false, false, 0)
      state.worldGems.push({
        x: w1X + 45,
        y: w1Y - 40,
        taken: false
      })
    } else if (r < 0.86) {
      addSegment(105, -0.82, false, false, 0)
      addSegment(65, -0.75, true, false, 0)
      const topX = state.lastX
      const topY = state.lastY
      addSegment(60, 1.25, false, true, topY)
      addSegment(60, 0.0, false, true, topY)
      addSegment(90, 0.48, false, false, 0)
      addSegment(80, 0.0, false, false, 0)
      state.worldGems.push({
        x: topX + 58,
        y: topY - 44,
        taken: false
      })
    } else {
      addSegment(65, 0.35, false, false, 0)
      addSegment(60, 0.0, false, false, 0)
      addSegment(70, -0.68, true, false, 0)
      const lipX = state.lastX
      const lipY = state.lastY
      addSegment(50, 0.90, false, true, lipY)
      const hazX = state.lastX
      const hazY = state.lastY
      addSegment(50, -0.70, false, true, lipY)
      addSegment(75, 0.25, false, false, 0)
      addSegment(75, 0.0, false, false, 0)
      state.hazards.push({
        x: hazX,
        y: hazY - 8
      })
      state.worldGems.push({
        x: lipX + 50,
        y: lipY - 36,
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
          kicker: s.kicker && u > 0.84,
          abyss: s.abyss,
          lipY: s.lipY
        }
      }
    }
    return { y: state.lastY, m: 0, angle: 0, kicker: false, abyss: false, lipY: 0 }
  }

  function updateColors() {
    const phase = (state.score * 0.022 + state.bike.x * 0.00018) % 1
    state.trackColor = interpolateSpectrum(phase, 1.0)
    state.fillColor = interpolateSpectrum(phase, 0.16)
    state.bikeColor = interpolateSpectrum(phase + 0.38, 1.0)
    state.accentColor = interpolateSpectrum(phase + 0.68, 1.0)
  }

  function updateProjections() {
    const b = state.bike
    const worldLeft = b.x - BIKE_SCREEN_X
    const groundAtBike = sampleTerrainY(b.x)

    const focusY = b.onGround ? b.y : b.y * 0.68 + groundAtBike * 0.32
    const targetCamY = focusY - 156
    state.camY += (targetCamY - state.camY) * 0.24
    const camY = state.camY

    for (let i = 0; i < CHART_POINTS; i++) {
      const sy = sampleTerrainY(worldLeft + i * POINT_STEP) - camY
      chartData[i] = clamp(Math.round(VIEW_H - sy), 4, VIEW_H - 4)
    }

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const sx = BIKE_SCREEN_X
    const sy = clamp(b.y - camY, 12, VIEW_H - 12)

    b.rx = Math.round(sx - cosA * 10 - 6)
    b.ry = Math.round(sy - sinA * 10 - 6)
    b.cx = Math.round(sx + sinA * 5 - 6)
    b.cy = Math.round(sy - cosA * 5 - 5)
    b.fx = Math.round(sx + cosA * 10 - 6)
    b.fy = Math.round(sy + sinA * 10 - 6)

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
    state.lastY = 180
    state.lastM = 0
    searchHint = 0

    addSegment(80, 0.0, false, false, 0)
    addSegment(85, 0.72, false, false, 0)
    addSegment(75, 0.0, false, false, 0)
    addSegment(85, -0.78, true, false, 0)
    const lipY = state.lastY
    addSegment(55, 0.92, false, true, lipY)
    addSegment(55, 0.0, false, true, lipY)
    addSegment(80, 0.35, false, false, 0)
    addSegment(75, 0.0, false, false, 0)
    for (let i = 0; i < 6; i++) {
      appendProceduralChunk()
    }

    const startSample = sampleTerrain(50)
    state.bike.x = 50
    state.bike.y = startSample.y - 6
    state.bike.vx = 95
    state.bike.vy = 0
    state.bike.speed = 95
    state.bike.angle = startSample.angle
    state.bike.angVel = 0
    state.bike.onGround = true
    state.bike.airTime = 0
    state.bike.airRotation = 0
    state.bike.airFlips = 0
    state.camY = state.bike.y - 156
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
    const gravity = 510

    if (b.onGround) {
      const cur = sampleTerrain(b.x)

      if (cur.abyss && b.y > cur.lipY + 28) {
        triggerCrash('В ПРОПАСТЬ!')
        return { event: 'crash' }
      }

      if (isPressing) {
        if (b.speed < 145) {
          b.speed += 440 * dt
        }
        const uphillBoost = cur.angle < 0 ? -Math.sin(cur.angle) * 115 : 0
        const downhillBoost = cur.angle > 0 ? Math.sin(cur.angle) * 210 : 0
        b.speed += (270 + uphillBoost + downhillBoost) * dt
      } else {
        const slopeGravity = Math.sin(cur.angle) * 260
        b.speed += slopeGravity * dt
        b.speed *= 1 - 0.38 * dt
      }

      b.speed = clamp(b.speed, 38, 275)

      const stepDist = b.speed * dt
      const nextX = b.x + Math.max(1.2, stepDist * Math.cos(cur.angle * 0.65))
      const next = sampleTerrain(nextX)

      const angleDrop = next.angle - cur.angle

      if (
        (cur.kicker && b.speed > 95) ||
        (angleDrop > 0.09 && b.speed > 120) ||
        (next.abyss && !cur.abyss)
      ) {
        b.onGround = false
        b.airTime = 0
        b.airRotation = 0
        b.airFlips = 0
        const launchAngle = clamp(cur.angle, -0.78, -0.25)
        b.x = nextX
        b.vx = clamp(b.speed * Math.cos(launchAngle), 90, 225)
        b.vy = b.speed * Math.sin(launchAngle) - (b.speed > 165 ? 36 : 12)
        b.y = cur.y - 7
        b.angVel = isPressing ? -2.2 : 0
      } else {
        b.x = nextX
        b.y = next.y - 6
        b.vx = b.speed * Math.cos(next.angle)
        b.vy = b.speed * Math.sin(next.angle)
        const wheelieOffset = isPressing && b.speed > 195 ? -0.14 : 0
        b.angle = next.angle + wheelieOffset
        b.angVel = 0
      }
    } else {
      b.airTime += dt
      b.x += b.vx * dt
      b.vy += gravity * dt
      b.y += b.vy * dt

      const maxSpin = state.turboFlip ? 10.6 : 8.4
      const spinAcc = state.turboFlip ? 38.0 : 28.0

      if (isPressing) {
        b.angVel = Math.max(-maxSpin, b.angVel - spinAcc * dt)
      } else {
        b.angVel *= Math.max(0, 1 - 16.0 * dt)
      }

      const dTheta = b.angVel * dt
      b.angle = normalizeAngle(b.angle + dTheta)
      if (dTheta < 0) {
        b.airRotation += -dTheta
        const totalFlips = Math.floor((b.airRotation + 1.05) / 6.283185307179586)
        if (totalFlips > b.airFlips) {
          b.airFlips = totalFlips
          state.score += 2 * state.combo
          state.bannerText = 'САЛЬТО x' + b.airFlips
          state.bannerTimer = 0.75
          event = 'flip'
        }
      }

      const ground = sampleTerrain(b.x)
      if (ground.abyss && b.y > ground.lipY + 42 && b.vy > 40) {
        triggerCrash('В ПРОПАСТЬ!')
        return { event: 'crash' }
      }

      if (b.y >= ground.y - 6 && b.vy >= -10) {
        if (ground.abyss) {
          triggerCrash('В ПРОПАСТЬ!')
          return { event: 'crash' }
        }

        const diff = Math.abs(normalizeAngle(b.angle - ground.angle))
        if (diff > 1.12) {
          triggerCrash('РАЗБИЛСЯ!')
          return { event: 'crash' }
        }

        b.y = ground.y - 6
        b.onGround = true
        b.angle = ground.angle
        b.angVel = 0

        const impactSpeed = Math.hypot(b.vx, b.vy)
        b.speed = clamp(Math.max(b.speed, impactSpeed * 0.88), 110, 275)

        if (b.airFlips > 0) {
          if (diff < 0.35) {
            state.combo = Math.min(5, state.combo + 1)
            const bonus = b.airFlips * 3 * state.combo
            state.score += bonus
            b.speed = Math.min(275, b.speed + 25)
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
      if (dx * dx + dy * dy < 210) {
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

    while (state.lastX < b.x + 440) {
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

    colorTick = (colorTick + 1) % 10
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
      bikeColor: state.bikeColor,
      accentColor: state.accentColor,
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
