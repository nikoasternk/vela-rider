export const VIEW_W = 208
export const VIEW_H = 260
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

  const rawSampleY = new Float64Array(CHART_POINTS)
  const chartData = new Array(CHART_POINTS)
  for (let i = 0; i < CHART_POINTS; i++) {
    chartData[i] = 120
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
    nodes: [],
    worldGems: [],
    hazards: [],
    bike: {
      x: 52,
      y: 140,
      vx: 0,
      vy: 0,
      speed: 0,
      angle: 0,
      angVel: 0,
      onGround: true,
      airTime: 0,
      airRotation: 0,
      airFlips: 0,
      rx: 41,
      ry: 140,
      cx: 52,
      cy: 140,
      fx: 63,
      fy: 140,
      vxVisor: 52,
      vyVisor: 131
    },
    gemX: -30,
    gemY: -30,
    hazX: -30,
    hazY: -30,
    chartData
  }

  function addNode(x, y) {
    state.nodes.push({ x, y })
  }

  function appendProceduralChunk() {
    const last = state.nodes[state.nodes.length - 1]
    const x0 = last.x
    const y0 = last.y
    const r = nextRand()

    if (r < 0.30) {
      const dip = 42 + nextRand() * 28
      const rise = 62 + nextRand() * 34
      const w1 = 92 + nextRand() * 24
      const w2 = 88 + nextRand() * 22
      const w3 = 96 + nextRand() * 26
      const yValley = y0 + dip
      const yCrest = yValley - rise
      const yLand = yCrest + 44 + nextRand() * 24
      addNode(x0 + w1, yValley)
      addNode(x0 + w1 + w2, yCrest)
      addNode(x0 + w1 + w2 + w3, yLand)
      state.worldGems.push({
        x: x0 + w1 + w2 + 24,
        y: yCrest - 36,
        taken: false
      })
    } else if (r < 0.58) {
      const climb = 58 + nextRand() * 36
      const drop = 68 + nextRand() * 36
      const w1 = 96 + nextRand() * 24
      const w2 = 104 + nextRand() * 28
      const yPeak = y0 - climb
      const yBowl = yPeak + drop
      const yOut = yBowl - 32
      addNode(x0 + w1, yPeak)
      addNode(x0 + w1 + w2, yBowl)
      addNode(x0 + w1 + w2 + 88, yOut)
      state.worldGems.push({
        x: x0 + w1 + 18,
        y: yPeak - 38,
        taken: false
      })
    } else if (r < 0.82) {
      const approachDip = 36 + nextRand() * 22
      const kickerRise = 56 + nextRand() * 26
      const pitDepth = 68 + nextRand() * 22
      const yDip = y0 + approachDip
      const yLip = yDip - kickerRise
      const yPit = yLip + pitDepth
      const yCatch = yLip + 18 + nextRand() * 20
      addNode(x0 + 82, yDip)
      addNode(x0 + 154, yLip)
      addNode(x0 + 218, yPit)
      addNode(x0 + 284, yCatch)
      addNode(x0 + 364, yCatch + 24)
      state.hazards.push({
        x: x0 + 218,
        y: yPit - 8
      })
      state.worldGems.push({
        x: x0 + 218,
        y: yLip - 42,
        taken: false
      })
    } else {
      const plunge = 64 + nextRand() * 34
      const launch = 74 + nextRand() * 34
      const yLow = y0 + plunge
      const yHigh = yLow - launch
      const yNext = yHigh + 38
      addNode(x0 + 98, yLow)
      addNode(x0 + 184, yHigh)
      addNode(x0 + 278, yNext)
      state.worldGems.push({
        x: x0 + 204,
        y: yHigh - 44,
        taken: false
      })
    }
  }

  let searchHint = 0

  function sampleTerrain(wx) {
    const nodes = state.nodes
    const len = nodes.length
    if (searchHint >= len - 1) searchHint = 0

    let segIdx = searchHint
    if (wx < nodes[segIdx].x) {
      segIdx = 0
    }
    for (let i = segIdx; i < len - 1; i++) {
      if (wx >= nodes[i].x && wx <= nodes[i + 1].x) {
        segIdx = i
        searchHint = i
        break
      }
      if (wx > nodes[i + 1].x) {
        segIdx = i
      }
    }

    const a = nodes[segIdx]
    const b = nodes[segIdx + 1] || a
    const dx = Math.max(1, b.x - a.x)
    const u = clamp((wx - a.x) / dx, 0, 1)

    const mu = (1 - Math.cos(3.141592653589793 * u)) * 0.5
    const y = a.y * (1 - mu) + b.y * mu
    const dydx =
      ((1.5707963267948966 * Math.sin(3.141592653589793 * u)) / dx) *
      (b.y - a.y)

    return {
      y,
      dydx,
      angle: Math.atan2(dydx, 1)
    }
  }

  function updateColors() {
    const phase = (state.bike.x * 0.00025 + state.score * 0.009) % 1
    state.trackColor = interpolateSpectrum(phase, 1.0)
    state.fillColor = interpolateSpectrum(phase, 0.16)
  }

  function updateProjections() {
    const b = state.bike
    const worldLeft = b.x - BIKE_SCREEN_X

    let minY = b.y - 24
    let maxY = b.y + 20
    for (let i = 0; i < CHART_POINTS; i++) {
      const sy = sampleTerrain(worldLeft + i * POINT_STEP).y
      rawSampleY[i] = sy
      if (sy < minY) minY = sy
      if (sy > maxY) maxY = sy
    }

    const midY = (minY + maxY) * 0.5
    const targetCamY = b.y * 0.55 + midY * 0.45 - VIEW_H * 0.52
    state.camY += (targetCamY - state.camY) * 0.28

    if (maxY - state.camY > VIEW_H - 14) {
      state.camY = maxY - (VIEW_H - 14)
    }
    if (minY - state.camY < 14) {
      state.camY = minY - 14
    }

    const camY = state.camY

    for (let i = 0; i < CHART_POINTS; i++) {
      const syScreen = rawSampleY[i] - camY
      chartData[i] = clamp(Math.round(VIEW_H - syScreen), 8, VIEW_H - 8)
    }

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const sx = BIKE_SCREEN_X
    const sy = clamp(b.y - camY, 10, VIEW_H - 10)

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
    state.nodes = []
    state.worldGems = []
    state.hazards = []
    searchHint = 0
    addNode(0, 150)
    addNode(95, 150)
    addNode(185, 184)
    addNode(275, 126)
    for (let i = 0; i < 6; i++) {
      appendProceduralChunk()
    }

    const startSample = sampleTerrain(52)
    state.bike.x = 52
    state.bike.y = startSample.y - 6
    state.bike.vx = 120
    state.bike.vy = 0
    state.bike.speed = 120
    state.bike.angle = startSample.angle
    state.bike.angVel = 0
    state.bike.onGround = true
    state.bike.airTime = 0
    state.bike.airRotation = 0
    state.bike.airFlips = 0
    state.camY = state.bike.y - VIEW_H * 0.55
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
    const gravity = 430

    if (b.onGround) {
      const cur = sampleTerrain(b.x)

      if (isPressing) {
        if (b.speed < 155) {
          b.speed += 520 * dt
        }
        const uphillBoost = cur.angle < 0 ? -Math.sin(cur.angle) * 95 : 0
        const downhillBoost = cur.angle > 0 ? Math.sin(cur.angle) * 240 : 0
        b.speed += (330 + uphillBoost + downhillBoost) * dt
      } else {
        const downhillCoast = cur.angle > 0 ? Math.sin(cur.angle) * 160 : 0
        b.speed += downhillCoast * dt
        b.speed *= 1 - 0.14 * dt
      }

      b.speed = clamp(b.speed, 115, 375)

      const stepDist = b.speed * dt
      const nextX = b.x + Math.max(2.5, stepDist * Math.cos(cur.angle * 0.65))
      const next = sampleTerrain(nextX)

      const angleDrop = next.angle - cur.angle
      const centrifugalLift = (b.speed * angleDrop) / dt

      if (
        (angleDrop > 0.055 && b.speed > 145 && centrifugalLift > 210) ||
        (cur.angle < -0.22 && angleDrop > 0.04 && b.speed > 140)
      ) {
        b.onGround = false
        b.airTime = 0
        b.airRotation = 0
        b.airFlips = 0
        const launchAngle = Math.min(cur.angle, -0.24)
        b.x = nextX
        b.vx = Math.max(145, b.speed * Math.cos(launchAngle))
        b.vy = b.speed * Math.sin(launchAngle) - 58
        b.y = cur.y - 7
        b.angVel = isPressing ? -5.5 : 0
      } else {
        b.x = nextX
        b.y = next.y - 6
        b.vx = b.speed * Math.cos(next.angle)
        b.vy = b.speed * Math.sin(next.angle)
        const wheelieOffset = isPressing && b.speed > 210 ? -0.12 : 0
        b.angle = next.angle + wheelieOffset
        b.angVel = 0
      }
    } else {
      b.airTime += dt
      b.x += b.vx * dt
      b.vy += gravity * dt
      b.y += b.vy * dt

      const maxSpin = state.turboFlip ? 15.2 : 13.0
      const spinAcc = state.turboFlip ? 54.0 : 44.0

      if (isPressing) {
        b.angVel = Math.max(-maxSpin, b.angVel - spinAcc * dt)
      } else {
        b.angVel *= Math.max(0, 1 - 18.0 * dt)
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
      if (b.y >= ground.y - 6 && b.vy >= -20) {
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
        b.speed = clamp(Math.max(b.speed, impactSpeed * 0.92), 130, 375)

        if (b.airFlips > 0) {
          if (diff < 0.38) {
            state.combo = Math.min(5, state.combo + 1)
            const bonus = b.airFlips * 3 * state.combo
            state.score += bonus
            b.speed = Math.min(375, b.speed + 35)
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

    const distanceScore = (b.x / 95) | 0
    if (distanceScore > state.score) {
      state.score = distanceScore
    }
    if (state.score > state.bestScore) {
      state.bestScore = state.score
    }

    while (state.nodes[state.nodes.length - 1].x < b.x + 380) {
      appendProceduralChunk()
    }
    while (state.nodes.length > 10 && state.nodes[1].x < b.x - 160) {
      state.nodes.shift()
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
