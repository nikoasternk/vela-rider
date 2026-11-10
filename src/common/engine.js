export const VIEW_W = 200
export const VIEW_H = 480
export const CHART_POINTS = 21
export const POINT_STEP = 10
export const BIKE_SCREEN_X = 50
export const BIKE_VIEW_Y = 250

const SPECTRUM = [
  [0, 240, 255],
  [120, 60, 255],
  [255, 0, 110],
  [255, 80, 0],
  [255, 210, 0],
  [0, 255, 130]
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
    chartData[i] = 230
  }

  const state = {
    status: 'menu',
    crashReason: 'CRASHED!',
    score: 0,
    bestScore: 0,
    gems: 0,
    combo: 1,
    bannerText: 'TAP & HOLD TO RIDE',
    bannerTimer: 0,
    colorPhase: 0,
    trackColor: '#00F0FF',
    fillColor: '#042230',
    bikeColor: '#FF006E',
    turboFlip: false,
    camY: 0,
    nodes: [],
    worldGems: [],
    bike: {
      x: 50,
      y: 240,
      vx: 0,
      vy: 0,
      speed: 0,
      angle: 0,
      angVel: 0,
      onGround: true,
      airTime: 0,
      airRotation: 0,
      airFlips: 0,
      rx: 39,
      ry: 240,
      cx: 50,
      cy: 240,
      fx: 61,
      fy: 240,
      vxVisor: 50,
      vyVisor: 231
    },
    gemX: -30,
    gemY: -30,
    chartData
  }

  function addNode(x, y, canyon, lipY) {
    state.nodes.push({
      x,
      y,
      canyon: Boolean(canyon),
      lipY: lipY !== undefined ? lipY : y
    })
  }

  function appendProceduralChunk() {
    const last = state.nodes[state.nodes.length - 1]
    const x0 = last.x
    const y0 = last.y
    const r = nextRand()

    if (r < 0.28) {
      const dip = 55 + nextRand() * 45
      const rise = 65 + nextRand() * 55
      const w1 = 95 + nextRand() * 35
      const w2 = 95 + nextRand() * 35
      const w3 = 90 + nextRand() * 30
      const yValley = y0 + dip
      const yPeak = yValley - rise
      const yOut = yPeak + 35 + nextRand() * 30
      addNode(x0 + w1, yValley, false, y0)
      addNode(x0 + w1 + w2, yPeak, false, yPeak)
      addNode(x0 + w1 + w2 + w3, yOut, false, yOut)
      state.worldGems.push({
        x: x0 + w1 + w2 + 20,
        y: yPeak - 36,
        taken: false
      })
    } else if (r < 0.56) {
      const dip = 45 + nextRand() * 30
      const kickerH = 60 + nextRand() * 35
      const gapW = 90 + nextRand() * 35
      const yDip = y0 + dip
      const yLip = yDip - kickerH
      const yAbyss = yLip + 360
      const yCatch = yLip + 28 + (nextRand() - 0.3) * 40
      addNode(x0 + 85, yDip, false, y0)
      addNode(x0 + 160, yLip, false, yLip)
      addNode(x0 + 160 + gapW * 0.45, yAbyss, true, yLip)
      addNode(x0 + 160 + gapW, yCatch, false, yLip)
      addNode(x0 + 250 + gapW, yCatch + 32, false, yCatch)
      state.worldGems.push({
        x: x0 + 160 + gapW * 0.45,
        y: yLip - 48,
        taken: false
      })
    } else if (r < 0.80) {
      const drop = 85 + nextRand() * 55
      const launch = 95 + nextRand() * 50
      const yBowl = y0 + drop
      const yCrest = yBowl - launch
      const yLand = yCrest + 55 + nextRand() * 35
      addNode(x0 + 105, yBowl, false, y0)
      addNode(x0 + 195, yCrest, false, yCrest)
      addNode(x0 + 295, yLand, false, yLand)
      state.worldGems.push({
        x: x0 + 215,
        y: yCrest - 50,
        taken: false
      })
    } else {
      const delta = (nextRand() < 0.5 ? 1 : -1) * (55 + nextRand() * 55)
      const yMid = y0 + delta
      const yCrest = yMid - 48
      const yEnd = yCrest + 45 + delta * 0.4
      addNode(x0 + 95, yMid, false, y0)
      addNode(x0 + 175, yCrest, false, yCrest)
      addNode(x0 + 265, yEnd, false, yEnd)
      state.worldGems.push({
        x: x0 + 190,
        y: yCrest - 38,
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
      angle: Math.atan2(dydx, 1),
      canyon: a.canyon || b.canyon,
      lipY: a.canyon ? a.lipY : b.lipY
    }
  }

  function updateColors() {
    const phase = (state.bike.x * 0.00022 + state.score * 0.008) % 1
    state.colorPhase = phase
    state.trackColor = interpolateSpectrum(phase, 1.0)
    state.fillColor = interpolateSpectrum(phase, 0.16)
    state.bikeColor = interpolateSpectrum(phase + 0.42, 1.0)
  }

  function updateProjections() {
    const b = state.bike
    const worldLeft = b.x - BIKE_SCREEN_X

    const lookAheadY = clamp(b.vy * 0.14, -45, 55)
    const targetCamY = b.y - BIKE_VIEW_Y + lookAheadY
    const diffCam = targetCamY - state.camY
    if (Math.abs(diffCam) > 1.5) {
      state.camY += diffCam * 0.18
    }
    const camY = state.camY

    for (let i = 0; i < CHART_POINTS; i++) {
      const sampleX = worldLeft + i * POINT_STEP
      const t = sampleTerrain(sampleX)
      const syScreen = t.y - camY
      chartData[i] = clamp(Math.round(VIEW_H - syScreen), 0, VIEW_H)
    }

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const sx = BIKE_SCREEN_X
    const sy = b.y - camY

    b.rx = Math.round(sx - cosA * 11 - 6)
    b.ry = Math.round(sy - sinA * 11 - 6)
    b.cx = Math.round(sx - 6)
    b.cy = Math.round(sy - 5)
    b.fx = Math.round(sx + cosA * 11 - 6)
    b.fy = Math.round(sy + sinA * 11 - 6)
    b.vxVisor = Math.round(sx + sinA * 8 - 4)
    b.vyVisor = Math.round(sy - cosA * 8 - 4)

    let gx = -30
    let gy = -30
    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const scX = Math.round(g.x - worldLeft - 5)
        const scY = Math.round(g.y - camY - 5)
        if (scX >= -12 && scX <= VIEW_W + 12 && scY >= -12 && scY <= VIEW_H + 12) {
          gx = scX
          gy = scY
          break
        }
      }
    }
    state.gemX = gx
    state.gemY = gy
  }

  function resetWorld() {
    state.nodes = []
    state.worldGems = []
    searchHint = 0
    addNode(0, 246, false, 246)
    addNode(95, 246, false, 246)
    addNode(190, 282, false, 246)
    addNode(285, 218, false, 218)
    for (let i = 0; i < 6; i++) {
      appendProceduralChunk()
    }

    const startSample = sampleTerrain(50)
    state.bike.x = 50
    state.bike.y = startSample.y - 6
    state.bike.vx = 0
    state.bike.vy = 0
    state.bike.speed = 0
    state.bike.angle = startSample.angle
    state.bike.angVel = 0
    state.bike.onGround = true
    state.bike.airTime = 0
    state.bike.airRotation = 0
    state.bike.airFlips = 0
    state.camY = state.bike.y - BIKE_VIEW_Y
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
    state.bannerText = 'GO!'
    state.bannerTimer = 0.8
    updateProjections()
  }

  function integrateSubstep(dt, isPressing) {
    const b = state.bike
    const gravity = 430
    const wheelBase = 11
    const wheelRadius = 6

    b.vy += gravity * dt

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const rxW = b.x - cosA * wheelBase
    const ryW = b.y - sinA * wheelBase
    const fxW = b.x + cosA * wheelBase
    const fyW = b.y + sinA * wheelBase

    const tR = sampleTerrain(rxW)
    const tF = sampleTerrain(fxW)
    const tC = sampleTerrain(b.x)

    if (tC.canyon && b.y > tC.lipY + 135) {
      triggerCrash('VOID FALL!')
      return 'crash'
    }

    const penR = ryW - (tR.y - wheelRadius)
    const penF = fyW - (tF.y - wheelRadius)
    const rearTouch = !tR.canyon && penR >= -2.2
    const frontTouch = !tF.canyon && penF >= -2.2

    const chordAngle = Math.atan2(tF.y - tR.y, Math.max(4, fxW - rxW))

    if (rearTouch || frontTouch) {
      const refAngle = rearTouch && frontTouch ? chordAngle : rearTouch ? tR.angle : tF.angle
      const impactDiff = Math.abs(normalizeAngle(b.angle - refAngle))

      if (impactDiff > 1.38) {
        triggerCrash('CRASHED!')
        return 'crash'
      }

      let landedEvent = null
      if (!b.onGround && b.airTime > 0.12) {
        if (b.airFlips > 0) {
          if (impactDiff < 0.36) {
            state.combo = Math.min(5, state.combo + 1)
            const bonus = b.airFlips * 3 * state.combo
            state.score += bonus
            state.bannerText = 'PERFECT +' + bonus
            state.bannerTimer = 0.9
          } else {
            state.combo = 1
            const bonus = b.airFlips * 2
            state.score += bonus
            state.bannerText = 'CLEAN +' + bonus
            state.bannerTimer = 0.8
          }
          landedEvent = 'land'
        }
      }

      const tx = Math.cos(refAngle)
      const ty = Math.sin(refAngle)
      const nx = -ty
      const ny = tx

      const vIntoGround = b.vx * nx + b.vy * ny
      if (vIntoGround > 0) {
        b.vx -= vIntoGround * nx
        b.vy -= vIntoGround * ny
      }

      let tangentSpeed = b.vx * tx + b.vy * ty

      if (isPressing && rearTouch) {
        const torqueFactor = clamp(1.0 - tangentSpeed / 360, 0.2, 1.3)
        const driveAcc = 390 * torqueFactor
        b.vx += tx * driveAcc * dt
        b.vy += ty * driveAcc * dt
        tangentSpeed = b.vx * tx + b.vy * ty
      }

      const drag = isPressing ? 0.22 : 0.65
      b.vx *= 1 - drag * dt
      b.vy *= 1 - drag * dt

      b.x += b.vx * dt
      b.y += b.vy * dt

      const tCNext = sampleTerrain(b.x)
      const groundSurfaceY = tCNext.y - wheelRadius
      if (!tCNext.canyon && b.y > groundSurfaceY) {
        const slopeFollowVy = b.vx * tCNext.dydx
        if (b.vy >= slopeFollowVy - 28) {
          b.y = groundSurfaceY
          b.vy = slopeFollowVy
          b.onGround = true
          b.airTime = 0
          b.airRotation = 0
          b.airFlips = 0

          const targetPitch =
            isPressing && tangentSpeed > 150
              ? tCNext.angle - 0.14
              : tCNext.angle
          const angErr = normalizeAngle(targetPitch - b.angle)
          b.angVel = angErr * 18
          b.angle = normalizeAngle(b.angle + b.angVel * dt)
        } else {
          b.onGround = false
        }
      } else {
        b.onGround = false
      }

      b.speed = Math.hypot(b.vx, b.vy)
      return landedEvent
    }

    b.onGround = false
    b.airTime += dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.speed = Math.hypot(b.vx, b.vy)

    const maxSpin = state.turboFlip ? 13.8 : 11.8
    const spinAcc = state.turboFlip ? 46.0 : 36.0

    if (isPressing) {
      b.angVel = Math.max(-maxSpin, b.angVel - spinAcc * dt)
    } else {
      b.angVel *= Math.max(0, 1 - 11.5 * dt)
    }

    const dTheta = b.angVel * dt
    b.angle = normalizeAngle(b.angle + dTheta)
    if (dTheta < 0) {
      b.airRotation += -dTheta
      const totalFlips = Math.floor((b.airRotation + 0.36) / 6.283185307179586)
      if (totalFlips > b.airFlips) {
        b.airFlips = totalFlips
        state.score += 2 * state.combo
        state.bannerText = 'FLIP x' + b.airFlips
        state.bannerTimer = 0.8
        return 'flip'
      }
    }

    return null
  }

  let colorTickCounter = 0

  function step(dtInput, isPressing) {
    const dt = clamp(dtInput, 0.012, 0.05)
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

    const subDt = dt * 0.5
    const ev1 = integrateSubstep(subDt, isPressing)
    if (ev1 === 'crash') {
      return { event: 'crash' }
    }
    if (ev1) event = ev1

    const ev2 = integrateSubstep(subDt, isPressing)
    if (ev2 === 'crash') {
      return { event: 'crash' }
    }
    if (ev2 && !event) event = ev2

    const b = state.bike
    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const dx = g.x - b.x
        const dy = g.y - b.y
        if (dx * dx + dy * dy < 400) {
          g.taken = true
          state.gems += 1
          state.score += 3
          state.bannerText = 'GEM +3'
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

    colorTickCounter = (colorTickCounter + 1) & 3
    if (colorTickCounter === 0) {
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
      score: state.score,
      bestScore: state.bestScore,
      gems: state.gems,
      bannerText: state.bannerText,
      bike: state.bike,
      chartData: state.chartData,
      gemX: state.gemX,
      gemY: state.gemY
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
