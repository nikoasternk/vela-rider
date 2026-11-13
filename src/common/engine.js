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
    turboFlip: false,
    zoomMode: 0,
    zoomScale: 1.0,
    difficultyMode: 1,
    obstacleMode: 0,
    viewW: VIEW_W,
    viewH: VIEW_H,
    camY: 0,
    worldOffsetX: 0,
    segs: [],
    lastX: 0,
    lastY: 180,
    lastM: 0,
    chunkCounter: 0,
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
      onSteepDrop: false,
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
    chartData
  }

  const terrainOutMain = {
    x0: 0,
    x1: 100,
    y: 180,
    m: 0,
    angle: 0,
    kicker: false,
    abyss: false,
    steepDrop: false,
    peakLaunch: false,
    island: false,
    lipY: 180
  }

  const terrainOutAux = {
    x0: 0,
    x1: 100,
    y: 180,
    m: 0,
    angle: 0,
    kicker: false,
    abyss: false,
    steepDrop: false,
    peakLaunch: false,
    island: false,
    lipY: 180
  }

  const stepResult = {
    event: null
  }

  const renderSnapshot = {
    status: 'menu',
    crashReason: '',
    trackColor: RAINBOW_COLORS[0],
    score: 0,
    bestScore: 0,
    gems: 0,
    bannerText: '',
    bike: state.bike,
    chartData: state.chartData,
    gemX: -40,
    gemY: -40,
    hazX: -50,
    hazY: -50
  }

  function pushRawSegment(dx, nextM, isKicker, isAbyss, isSteepDrop, isPeakLaunch, isIsland, lipY) {
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
      dx,
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
      steepDrop: Boolean(isSteepDrop),
      peakLaunch: Boolean(isPeakLaunch),
      island: Boolean(isIsland),
      lipY: lipY !== undefined ? lipY : y0
    })
    state.lastX = x1
    state.lastY = y1
    state.lastM = nextM
  }

  function addSegment(dx, nextM, isKicker, isSteepDrop, isIsland) {
    pushRawSegment(dx, nextM, isKicker, false, isSteepDrop, false, isIsland, state.lastY)
  }

  function addAbyss(allowAbyss, allowSaws, withSaw, withGem) {
    if (!allowAbyss) {
      addSegment(48, 0.25, false, false, false)
      addSegment(48, 0.0, false, false, false)
      return
    }
    const lipX = state.lastX
    const lipY = state.lastY
    pushRawSegment(32, 2.55, false, true, false, false, false, lipY)
    pushRawSegment(32, -1.85, false, true, false, false, false, lipY)
    pushRawSegment(32, 0.0, false, true, false, false, false, lipY)
    if (allowSaws && withSaw) {
      state.hazards.push({
        x: lipX + 48,
        y: lipY + 44,
        r: 13
      })
    }
    if (withGem) {
      state.worldGems.push({
        x: lipX + 48,
        y: lipY - 40,
        taken: false
      })
    }
  }

  function addRoadIsland(withGem) {
    const xMid = state.lastX + 45
    const yMid = state.lastY
    addSegment(74, 0.0, false, false, true)
    addSegment(64, -0.78, true, false, true)
    if (withGem) {
      state.worldGems.push({
        x: xMid,
        y: yMid - 22,
        taken: false
      })
    }
  }

  function addAbyssChain(islandCount, allowAbyss, allowSaws) {
    for (let i = 0; i < islandCount; i++) {
      addAbyss(allowAbyss, allowSaws, i % 2 === 0, true)
      addRoadIsland(i % 2 === 0)
    }
    addAbyss(allowAbyss, allowSaws, true, true)
    addSegment(85, 0.0, false, false, false)
    addSegment(65, 0.0, false, false, false)
  }

  function addHighMountain(withSaw, allowSaws) {
    if (!withSaw || !allowSaws) {
      addSegment(115, -1.05, false, false, false)
      addSegment(90, -0.82, true, false, false)
      const peakX = state.lastX
      const peakY = state.lastY
      state.worldGems.push({
        x: peakX + 55,
        y: peakY - 46,
        taken: false
      })
      addSegment(65, 1.18, false, false, false)
      addSegment(135, 1.18, false, false, false)
      addSegment(85, 0.0, false, false, false)
      addSegment(65, 0.0, false, false, false)
    } else {
      addSegment(120, -1.05, false, false, false)
      addSegment(85, -0.78, false, true, false)
      const peakStartX = state.lastX
      const peakStartY = state.lastY
      pushRawSegment(36, 0.0, false, false, true, true, false, peakStartY)
      addSegment(50, 1.35, false, false, false)
      addSegment(130, 1.35, false, false, false)
      state.hazards.push({
        x: peakStartX + 80,
        y: peakStartY - 35,
        r: 13
      })
      state.worldGems.push({
        x: peakStartX + 125,
        y: state.lastY - 26,
        taken: false
      })
      addSegment(85, 0.0, false, false, false)
      addSegment(65, 0.0, false, false, false)
    }

    if (state.lastY > 240) {
      addSegment(110, -0.85, false, false, false)
      addSegment(65, 0.0, false, false, false)
    } else if (state.lastY < 120) {
      addSegment(110, 0.85, false, false, false)
      addSegment(65, 0.0, false, false, false)
    }
  }

  function addSteepDescentWithRamp(allowAbyss, allowSaws) {
    addSegment(55, 1.28, false, false, false)
    addSegment(115, 1.28, false, false, false)
    addSegment(70, 0.0, false, false, false)
    addSegment(80, -0.82, true, false, false)
    addAbyss(allowAbyss, allowSaws, false, true)
    addSegment(90, 0.0, false, false, false)
    addSegment(65, -0.75, false, false, false)
    addSegment(65, 0.0, false, false, false)
  }

  function appendProceduralChunk() {
    const allowAbyss = state.obstacleMode !== 2
    const allowSaws = state.obstacleMode === 0
    const pattern = (state.chunkCounter + ((nextRand() * 2) | 0)) % 6
    state.chunkCounter += 1

    if (pattern === 0) {
      addHighMountain(false, allowSaws)
    } else if (pattern === 1) {
      addSegment(75, -0.78, true, false, false)
      addAbyssChain(2, allowAbyss, allowSaws)
    } else if (pattern === 2) {
      addHighMountain(true, allowSaws)
    } else if (pattern === 3) {
      addSteepDescentWithRamp(allowAbyss, allowSaws)
    } else if (pattern === 4) {
      addSegment(75, -0.78, true, false, false)
      addAbyssChain(1, allowAbyss, allowSaws)
      addHighMountain(false, allowSaws)
    } else {
      addHighMountain(true, allowSaws)
      addSegment(75, -0.78, true, false, false)
      addAbyssChain(2, allowAbyss, allowSaws)
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

  function sampleTerrainInto(wx, out) {
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
        out.x0 = s.x0
        out.x1 = s.x1
        out.y = y
        out.m = m
        out.angle = Math.atan2(m, 1)
        out.kicker = s.kicker && u > 0.84
        out.abyss = s.abyss
        out.steepDrop = s.steepDrop
        out.peakLaunch = s.peakLaunch
        out.island = s.island
        out.lipY = s.lipY
        return out
      }
    }
    out.x0 = 0
    out.x1 = 100
    out.y = state.lastY
    out.m = 0
    out.angle = 0
    out.kicker = false
    out.abyss = false
    out.steepDrop = false
    out.peakLaunch = false
    out.island = false
    out.lipY = state.lastY
    return out
  }

  let colorTick = 0

  function updateColors(force) {
    colorTick = (colorTick + 1) % 3
    if (force || colorTick === 0) {
      state.trackColor = computeRainbowTrackColor(state.worldOffsetX + state.bike.x)
    }
  }

  function rebaseWorldCoordinates() {
    const shift = 30000
    state.worldOffsetX += shift
    state.bike.x -= shift
    state.lastX -= shift
    for (let i = 0; i < state.segs.length; i++) {
      state.segs[i].x0 -= shift
      state.segs[i].x1 -= shift
    }
    for (let i = 0; i < state.worldGems.length; i++) {
      state.worldGems[i].x -= shift
    }
    for (let i = 0; i < state.hazards.length; i++) {
      state.hazards[i].x -= shift
    }
  }

  function updateProjections() {
    const b = state.bike
    const vw = state.viewW
    const vh = state.viewH
    const centerY = Math.round(vh * 0.52)
    const scale = state.zoomScale
    const invScale = 1.0 / scale
    const worldLeft = b.x - BIKE_SCREEN_X * invScale
    const worldStep = POINT_STEP * invScale

    const groundAtBike = sampleTerrainY(b.x)
    const lookaheadY = sampleTerrainY(b.x + 48)
    const focusY = b.onGround
      ? b.y * 0.76 + lookaheadY * 0.24
      : b.y * 0.64 + groundAtBike * 0.22 + lookaheadY * 0.14
    state.camY += (focusY - state.camY) * 0.24
    const camCenterY = state.camY

    for (let i = 0; i < CHART_POINTS; i++) {
      const wy = sampleTerrainY(worldLeft + i * worldStep)
      const sy = centerY + (wy - camCenterY) * scale
      chartData[i] = clamp(Math.round(vh - sy), 4, vh - 4)
    }

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const sx = BIKE_SCREEN_X
    const sy = clamp(centerY + (b.y - camCenterY) * scale, 12, vh - 12)
    const wheelSpan = 10 * scale

    b.rx = Math.round(sx - cosA * wheelSpan - 6)
    b.ry = Math.round(sy - sinA * wheelSpan - 6)
    b.cx = Math.round(sx + sinA * 5 * scale - 6)
    b.cy = Math.round(sy - cosA * 5 * scale - 5)
    b.fx = Math.round(sx + cosA * wheelSpan - 6)
    b.fy = Math.round(sy + sinA * wheelSpan - 6)

    let gx = -40
    let gy = -40
    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken && g.x >= b.x - 16) {
        const scX = Math.round(sx + (g.x - b.x) * scale - 5)
        const scY = Math.round(centerY + (g.y - camCenterY) * scale - 5)
        if (scX >= -10 && scX <= vw + 12 && scY >= 4 && scY <= vh - 10) {
          gx = scX
          gy = scY
          break
        }
      }
    }
    state.gemX = gx
    state.gemY = gy

    let hx = -50
    let hy = -50
    for (let i = 0; i < state.hazards.length; i++) {
      const h = state.hazards[i]
      if (h.x >= b.x - 18) {
        const scX = Math.round(sx + (h.x - b.x) * scale - 13)
        const scY = Math.round(centerY + (h.y - camCenterY) * scale - 13)
        if (scX >= -24 && scX <= vw + 24 && scY >= -24 && scY <= vh + 12) {
          hx = scX
          hy = scY
          break
        }
      }
    }
    state.hazX = hx
    state.hazY = hy
  }

  function setViewport(w, h) {
    state.viewW = clamp(Math.round(w || VIEW_W), 160, 260)
    state.viewH = clamp(Math.round(h || VIEW_H), 140, 360)
    updateProjections()
  }

  function resetWorld() {
    state.segs.length = 0
    state.worldGems.length = 0
    state.hazards.length = 0
    state.worldOffsetX = 0
    state.lastX = 0
    state.lastY = 180
    state.lastM = 0
    state.chunkCounter = 0
    searchHint = 0

    const allowAbyss = state.obstacleMode !== 2
    const allowSaws = state.obstacleMode === 0

    addSegment(95, 0.0, false, false, false)
    addSegment(75, -0.78, true, false, false)
    addAbyssChain(1, allowAbyss, allowSaws)
    addHighMountain(false, allowSaws)
    addHighMountain(true, allowSaws)

    const startSample = sampleTerrainInto(50, terrainOutMain)
    state.bike.x = 50
    state.bike.y = startSample.y - 6
    state.bike.vx = 95
    state.bike.vy = 0
    state.bike.speed = 95
    state.bike.angle = startSample.angle
    state.bike.angVel = 0
    state.bike.onGround = true
    state.bike.onSteepDrop = false
    state.bike.airTime = 0
    state.bike.airRotation = 0
    state.bike.airFlips = 0
    state.camY = state.bike.y
    updateColors(true)
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

  function checkSawHit(b, h) {
    const dx0 = h.x - b.x
    const dy0 = h.y - b.y
    if (dx0 * dx0 + dy0 * dy0 < 235) return true
    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const dxF = h.x - (b.x + cosA * 9)
    const dyF = h.y - (b.y + sinA * 9)
    if (dxF * dxF + dyF * dyF < 196) return true
    const dxR = h.x - (b.x - cosA * 9)
    const dyR = h.y - (b.y - sinA * 9)
    if (dxR * dxR + dyR * dyR < 196) return true
    return false
  }

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
      stepResult.event = null
      return stepResult
    }

    const b = state.bike
    const gravity = state.difficultyMode === 0 ? 480 : 500
    const maxSpeed = state.difficultyMode === 2 ? 295 : 275
    const crashAngleLimit =
      state.difficultyMode === 0 ? 1.35 : state.difficultyMode === 2 ? 0.96 : 1.15

    if (b.onGround) {
      const cur = sampleTerrainInto(b.x, terrainOutMain)
      const ahead = sampleTerrainInto(b.x + 55, terrainOutAux)
      b.onSteepDrop = cur.steepDrop || ahead.steepDrop

      if (cur.abyss && b.y > cur.lipY + 20) {
        triggerCrash('В ПРОПАСТЬ!')
        stepResult.event = 'crash'
        return stepResult
      }

      const sinA = Math.sin(cur.angle)
      if (isPressing) {
        if (b.speed < 148) {
          b.speed += 450 * dt
        }
        const uphillBoost = sinA < 0 ? -sinA * 125 : 0
        const downhillBoost = sinA > 0 ? sinA * 215 : 0
        b.speed += (275 + uphillBoost + downhillBoost) * dt
      } else {
        if (b.onSteepDrop && b.speed > 134) {
          b.speed = Math.max(130, b.speed - 280 * dt)
        } else if (sinA > 0.12) {
          const targetCoast = 148
          if (b.speed < targetCoast) {
            b.speed = Math.min(targetCoast, b.speed + sinA * 220 * dt)
          } else {
            b.speed = Math.max(targetCoast, b.speed - 140 * dt)
          }
        } else {
          const uphillBrake = sinA < 0 ? -sinA * 260 : 0
          b.speed = Math.max(0, b.speed - (110 + uphillBrake) * dt)
        }
      }

      b.speed = clamp(b.speed, 0, maxSpeed)

      const stepDist = b.speed * dt
      const nextX = b.x + stepDist * Math.cos(cur.angle * 0.65)
      const next = sampleTerrainInto(nextX, terrainOutAux)

      if (cur.peakLaunch && (isPressing || b.speed > 154) && b.speed > 125) {
        b.onGround = false
        b.onSteepDrop = false
        b.airTime = 0
        b.airRotation = 0
        b.airFlips = 0
        b.x = nextX
        b.vx = 170
        b.vy = -175
        b.y = cur.y - 7
        b.angVel = isPressing ? -2.6 : 0
      } else if ((cur.kicker && b.speed > 115) || (next.abyss && !cur.abyss)) {
        b.onGround = false
        b.onSteepDrop = false
        b.airTime = 0
        b.airRotation = 0
        b.airFlips = 0
        b.x = nextX
        if (b.speed < 115 && !isPressing) {
          b.vx = Math.max(45, b.speed * Math.cos(cur.angle))
          b.vy = b.speed * Math.sin(cur.angle)
          b.y = cur.y - 6
          b.angVel = 0
        } else {
          b.vx = clamp(b.speed * 0.92, 156, 174)
          b.vy = -175
          b.y = cur.y - 7
          b.angVel = isPressing ? -2.6 : 0
        }
      } else {
        b.x = nextX
        b.y = next.y - 6
        b.vx = b.speed * Math.cos(next.angle)
        b.vy = b.speed * Math.sin(next.angle)
        const wheelieOffset = isPressing && b.speed > 195 && !b.onSteepDrop ? -0.14 : 0
        b.angle = next.angle + wheelieOffset
        b.angVel = 0
      }
    } else {
      b.onSteepDrop = false
      b.airTime += dt
      b.x += b.vx * dt
      b.vy += gravity * dt
      b.y += b.vy * dt

      const maxSpin = state.turboFlip ? 10.6 : 8.6
      const spinAcc = state.turboFlip ? 38.0 : 29.0

      if (isPressing) {
        b.angVel = Math.max(-maxSpin, b.angVel - spinAcc * dt)
      } else {
        b.angVel *= Math.max(0, 1 - 16.0 * dt)
        if (b.airFlips > 0 && Math.abs(b.angle) < 1.35) {
          b.angle *= Math.max(0, 1 - 8.0 * dt)
        }
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

      const ground = sampleTerrainInto(b.x, terrainOutMain)
      if (ground.abyss && b.y > ground.lipY + 24 && b.vy > 30) {
        triggerCrash('В ПРОПАСТЬ!')
        stepResult.event = 'crash'
        return stepResult
      }

      if (b.y >= ground.y - 6 && b.vy >= -10) {
        if (ground.abyss) {
          triggerCrash('В ПРОПАСТЬ!')
          stepResult.event = 'crash'
          return stepResult
        }

        const diff = Math.abs(normalizeAngle(b.angle - ground.angle))
        if (diff > crashAngleLimit) {
          triggerCrash('РАЗБИЛСЯ!')
          stepResult.event = 'crash'
          return stepResult
        }

        b.y = ground.y - 6
        b.onGround = true
        b.angle = ground.angle
        b.angVel = 0

        const impactSpeed = Math.hypot(b.vx, b.vy)
        const minLandSpeed = ground.island ? 158 : 125
        b.speed = clamp(Math.max(b.speed, impactSpeed * 0.88), minLandSpeed, maxSpeed)

        if (b.airFlips > 0) {
          if (diff < 0.38) {
            state.combo = Math.min(5, state.combo + 1)
            const bonus = b.airFlips * 3 * state.combo
            state.score += bonus
            b.speed = Math.min(maxSpeed, b.speed + 25)
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
      if (checkSawHit(b, state.hazards[i])) {
        triggerCrash('ПИЛА!')
        stepResult.event = 'crash'
        return stepResult
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

    const totalWorldX = state.worldOffsetX + b.x
    const distanceScore = (totalWorldX / 90) | 0
    if (distanceScore > state.score) {
      state.score = distanceScore
    }
    if (state.score > state.bestScore) {
      state.bestScore = state.score
    }

    while (state.lastX < b.x + 620) {
      appendProceduralChunk()
    }
    while (state.segs.length > 6 && state.segs[0].x1 < b.x - 160) {
      state.segs.shift()
      if (searchHint > 0) searchHint -= 1
    }
    while (state.worldGems.length > 0 && state.worldGems[0].x < b.x - 120) {
      state.worldGems.shift()
    }
    while (state.hazards.length > 0 && state.hazards[0].x < b.x - 120) {
      state.hazards.shift()
    }

    if (b.x > 40000) {
      rebaseWorldCoordinates()
    }

    updateColors(false)
    updateProjections()
    stepResult.event = event
    return stepResult
  }

  function getRenderSnapshot() {
    renderSnapshot.status = state.status
    renderSnapshot.crashReason = state.crashReason
    renderSnapshot.trackColor = state.trackColor
    renderSnapshot.score = state.score
    renderSnapshot.bestScore = state.bestScore
    renderSnapshot.gems = state.gems
    renderSnapshot.bannerText = state.bannerText
    renderSnapshot.gemX = state.gemX
    renderSnapshot.gemY = state.gemY
    renderSnapshot.hazX = state.hazX
    renderSnapshot.hazY = state.hazY
    return renderSnapshot
  }

  resetWorld()

  return {
    state,
    setViewport,
    startGame,
    step,
    getRenderSnapshot
  }
}
