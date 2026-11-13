export const VIEW_W = 192
export const VIEW_H = 216
export const CHART_POINTS = 13
export const POINT_STEP = 16
export const BIKE_SCREEN_X = 48
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
  if (localU <= 0.84) return RAINBOW_COLORS[idx]
  const t = clamp((localU - 0.84) / 0.16, 0, 1)
  const s = t * t * (3 - 2 * t)
  const c0 = RAINBOW_RGB[idx]
  const c1 = RAINBOW_RGB[(idx + 1) % 7]
  const r = c0[0] + (c1[0] - c0[0]) * s
  const g = c0[1] + (c1[1] - c0[1]) * s
  const b = c0[2] + (c1[2] - c0[2]) * s
  return '#' + toHexByte(r) + toHexByte(g) + toHexByte(b)
}

export function createGameEngine(initialSeed = 20261113) {
  let rngState = initialSeed >>> 0

  function nextRand() {
    rngState ^= rngState << 13
    rngState ^= rngState >>> 17
    rngState ^= rngState << 5
    return (rngState >>> 0) / 4294967296
  }

  const chartData = new Array(CHART_POINTS)
  for (let i = 0; i < CHART_POINTS; i++) chartData[i] = 100

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
    renderZoom: 1.0,
    difficultyMode: 1,
    obstacleMode: 0,
    viewW: VIEW_W,
    viewH: VIEW_H,
    camY: 0,
    worldOffsetX: 0,
    segs: [],
    lastX: 0,
    lastY: 140,
    lastM: 0,
    chunkCounter: 0,
    worldGems: [],
    hazards: [],
    boosters: [],
    bike: {
      x: 50,
      y: 134,
      vx: 40,
      vy: 0,
      speed: 40,
      angle: 0,
      angVel: 0,
      wheelie: 0,
      onGround: true,
      onSteepDrop: false,
      airTime: 0,
      airRotation: 0,
      airFlips: 0,
      rx: 34,
      ry: 134,
      cx: 44,
      cy: 130,
      fx: 54,
      fy: 134
    },
    gemX: -40,
    gemY: -40,
    hazX: -50,
    hazY: -50,
    boostX: -60,
    boostY: -60,
    chartData
  }

  const terrainOutMain = {
    x0: 0,
    x1: 100,
    y: 140,
    m: 0,
    angle: 0,
    abyss: false,
    overSawZone: false,
    island: false,
    lipY: 140
  }

  const terrainOutAux = {
    x0: 0,
    x1: 100,
    y: 140,
    m: 0,
    angle: 0,
    abyss: false,
    overSawZone: false,
    island: false,
    lipY: 140
  }

  const stepResult = { event: null }

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
    hazY: -50,
    boostX: -60,
    boostY: -60
  }

  function pushRawSegment(dx, nextM, isAbyss, isOverSawZone, isIsland, lipY) {
    const x0 = state.lastX
    const y0 = state.lastY
    const m0 = state.lastM
    const x1 = x0 + dx
    const y1 = y0 + dx * 0.5 * (m0 + nextM)
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
      c1: dx * m0,
      c2: dx * 0.5 * (nextM - m0),
      abyss: Boolean(isAbyss),
      overSawZone: Boolean(isOverSawZone),
      island: Boolean(isIsland),
      lipY: lipY !== undefined ? lipY : y0
    })
    state.lastX = x1
    state.lastY = y1
    state.lastM = nextM
  }

  function addSegment(dx, nextM, isOverSawZone, isIsland) {
    pushRawSegment(dx, nextM, false, isOverSawZone, isIsland, state.lastY)
  }

  function addBoosterPad(dx) {
    const bx = state.lastX + dx * 0.5
    const by = state.lastY
    addSegment(dx, 0.0, false, false)
    state.boosters.push({ x: bx, y: by })
  }

  function addAbyss(allowAbyss, allowSaws, withSaw, withGem) {
    if (!allowAbyss) {
      addSegment(60, 0.25, false, false)
      addSegment(60, 0.0, false, false)
      return
    }
    const lipX = state.lastX
    const lipY = state.lastY
    pushRawSegment(40, 2.25, true, false, false, lipY)
    pushRawSegment(40, -1.65, true, false, false, lipY)
    pushRawSegment(40, 0.0, true, false, false, lipY)
    if (allowSaws && withSaw) {
      state.hazards.push({ x: lipX + 60, y: lipY + 34, r: 13 })
    }
    if (withGem) {
      state.worldGems.push({ x: lipX + 60, y: lipY - 38, taken: false })
    }
  }

  function addValleyRamp(withBooster, allowAbyss, allowSaws) {
    addSegment(64, 0.88, false, false)
    addSegment(64, 0.0, false, false)
    if (withBooster) {
      addBoosterPad(56)
    } else {
      addSegment(48, 0.0, false, false)
    }
    addSegment(82, -0.82, false, false)
    addAbyss(allowAbyss, allowSaws, true, true)
    addSegment(92, 0.0, false, false)
    addSegment(60, 0.0, false, false)
  }

  function addPeakMountain(mode, allowSaws) {
    const mType = allowSaws ? mode : 0
    if (mType === 0) {
      addSegment(96, -0.95, false, false)
      addSegment(64, -0.85, false, false)
      const peakX = state.lastX
      const peakY = state.lastY
      state.worldGems.push({ x: peakX + 52, y: peakY - 42, taken: false })
      addSegment(48, 0.95, false, false)
      addSegment(112, 0.95, false, false)
      addSegment(64, 0.0, false, false)
      addSegment(64, 0.0, false, false)
    } else if (mType === 1) {
      addSegment(104, -0.95, false, false)
      addSegment(76, -0.60, false, false)
      const crestX = state.lastX
      const crestY = state.lastY
      addSegment(48, 1.35, true, false)
      addSegment(120, 1.35, true, false)
      state.hazards.push({ x: crestX + 66, y: crestY - 14, r: 13 })
      state.worldGems.push({ x: crestX + 115, y: state.lastY - 22, taken: false })
      addSegment(72, 0.0, false, false)
      addSegment(56, 0.0, false, false)
    } else {
      addBoosterPad(52)
      addSegment(92, -0.86, false, false)
      const lipX = state.lastX
      const lipY = state.lastY
      addSegment(52, 0.85, false, false)
      addSegment(104, 0.85, false, false)
      state.hazards.push({ x: lipX + 60, y: lipY + 2, r: 13 })
      state.worldGems.push({ x: lipX + 60, y: lipY - 44, taken: false })
      addSegment(72, 0.0, false, false)
      addSegment(56, 0.0, false, false)
    }

    if (state.lastY > 210) {
      addSegment(96, -0.85, false, false)
      addSegment(64, 0.0, false, false)
    } else if (state.lastY < 90) {
      addSegment(96, 0.85, false, false)
      addSegment(64, 0.0, false, false)
    }
  }

  function addIslandHopper(allowAbyss, allowSaws) {
    addSegment(78, -0.78, false, false)
    addAbyss(allowAbyss, allowSaws, true, true)
    addSegment(76, 0.0, false, true)
    addSegment(68, -0.78, false, true)
    addAbyss(allowAbyss, allowSaws, false, true)
    addSegment(84, 0.0, false, false)
    addSegment(60, 0.0, false, false)
  }

  function appendProceduralChunk() {
    const allowAbyss = state.obstacleMode !== 2
    const allowSaws = state.obstacleMode === 0
    const pattern = (state.chunkCounter + ((nextRand() * 2) | 0)) % 6
    state.chunkCounter += 1

    if (pattern === 0) {
      addValleyRamp(true, allowAbyss, allowSaws)
    } else if (pattern === 1) {
      addPeakMountain(0, allowSaws)
    } else if (pattern === 2) {
      addPeakMountain(1, allowSaws)
    } else if (pattern === 3) {
      addIslandHopper(allowAbyss, allowSaws)
    } else if (pattern === 4) {
      addPeakMountain(2, allowSaws)
    } else {
      addValleyRamp(false, allowAbyss, allowSaws)
    }
  }

  let physSearchHint = 0
  let renderSearchHint = 0

  function sampleTerrainY(wx) {
    const segs = state.segs
    const len = segs.length
    if (renderSearchHint >= len) renderSearchHint = 0
    let idx = renderSearchHint
    if (wx < segs[idx].x0) idx = 0
    for (let i = idx; i < len; i++) {
      const s = segs[i]
      if (wx <= s.x1 || i === len - 1) {
        renderSearchHint = i
        const u = clamp((wx - s.x0) * s.invDx, 0, 1)
        return s.y0 + u * (s.c1 + u * s.c2)
      }
    }
    return state.lastY
  }

  function sampleCameraY(wx) {
    const segs = state.segs
    const len = segs.length
    if (renderSearchHint >= len) renderSearchHint = 0
    let idx = renderSearchHint
    if (wx < segs[idx].x0) idx = 0
    for (let i = idx; i < len; i++) {
      const s = segs[i]
      if (wx <= s.x1 || i === len - 1) {
        renderSearchHint = i
        if (s.abyss) return s.lipY
        const u = clamp((wx - s.x0) * s.invDx, 0, 1)
        return s.y0 + u * (s.c1 + u * s.c2)
      }
    }
    return state.lastY
  }

  function sampleTerrainInto(wx, out) {
    const segs = state.segs
    const len = segs.length
    if (physSearchHint >= len) physSearchHint = 0
    let idx = physSearchHint
    if (wx < segs[idx].x0) idx = 0
    for (let i = idx; i < len; i++) {
      const s = segs[i]
      if (wx <= s.x1 || i === len - 1) {
        physSearchHint = i
        const u = clamp((wx - s.x0) * s.invDx, 0, 1)
        const y = s.y0 + u * (s.c1 + u * s.c2)
        const m = s.m0 + u * s.dm
        out.x0 = s.x0
        out.x1 = s.x1
        out.y = y
        out.m = m
        out.angle = Math.atan2(m, 1)
        out.abyss = s.abyss
        out.overSawZone = s.overSawZone
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
    out.abyss = false
    out.overSawZone = false
    out.island = false
    out.lipY = state.lastY
    return out
  }

  let colorTick = 0

  function updateColors(force) {
    colorTick = (colorTick + 1) & 3
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
    for (let i = 0; i < state.worldGems.length; i++) state.worldGems[i].x -= shift
    for (let i = 0; i < state.hazards.length; i++) state.hazards[i].x -= shift
    for (let i = 0; i < state.boosters.length; i++) state.boosters[i].x -= shift
  }

  function updateProjections() {
    const b = state.bike
    const vw = state.viewW
    const vh = state.viewH
    const centerY = Math.round(vh * 0.56)

    const groundAtBike = sampleCameraY(b.x)
    const lookaheadY = sampleCameraY(b.x + 48)
    const airHeight = b.onGround ? 0 : Math.max(0, groundAtBike - b.y)
    const targetDynZoom = state.zoomScale * clamp(1.0 - airHeight / 280, 0.62, 1.0)
    state.renderZoom += (targetDynZoom - state.renderZoom) * 0.16

    const scale = state.renderZoom
    const invScale = 1.0 / scale
    const worldLeft = b.x - BIKE_SCREEN_X * invScale
    const worldStep = POINT_STEP * invScale

    const focusY = b.onGround
      ? b.y * 0.78 + lookaheadY * 0.22
      : b.y * 0.58 + groundAtBike * 0.28 + lookaheadY * 0.14
    state.camY += (focusY - state.camY) * 0.24
    const camCenterY = state.camY

    for (let i = 0; i < CHART_POINTS; i++) {
      const wy = sampleTerrainY(worldLeft + i * worldStep)
      const sy = centerY + (wy - camCenterY) * scale
      chartData[i] = clamp(Math.round(vh - sy), 4, vh - 4)
    }

    const visAngle = b.angle + (b.onGround ? b.wheelie : 0)
    const cosA = Math.cos(visAngle)
    const sinA = Math.sin(visAngle)
    const sx = BIKE_SCREEN_X
    const sy = clamp(centerY + (b.y - camCenterY) * scale, 10, vh - 10)
    const wheelSpan = 9 * scale

    b.rx = Math.round(sx - cosA * wheelSpan - 5)
    b.ry = Math.round(sy - sinA * wheelSpan - 5)
    b.cx = Math.round(sx + sinA * 4 * scale - 5)
    b.cy = Math.round(sy - cosA * 4 * scale - 4)
    b.fx = Math.round(sx + cosA * wheelSpan - 5)
    b.fy = Math.round(sy + sinA * wheelSpan - 5)

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
        const scX = Math.round(sx + (h.x - b.x) * scale - 12)
        const scY = Math.round(centerY + (h.y - camCenterY) * scale - 12)
        if (scX >= -24 && scX <= vw + 24 && scY >= -24 && scY <= vh + 12) {
          hx = scX
          hy = scY
          break
        }
      }
    }
    state.hazX = hx
    state.hazY = hy

    let bx = -60
    let by = -60
    for (let i = 0; i < state.boosters.length; i++) {
      const bs = state.boosters[i]
      if (bs.x >= b.x - 24) {
        const scX = Math.round(sx + (bs.x - b.x) * scale - 14)
        const scY = Math.round(centerY + (bs.y - camCenterY) * scale - 4)
        if (scX >= -28 && scX <= vw + 28 && scY >= 0 && scY <= vh) {
          bx = scX
          by = scY
          break
        }
      }
    }
    state.boostX = bx
    state.boostY = by
  }

  function setViewport(w, h) {
    state.viewW = clamp(Math.round(w || VIEW_W), 160, 260)
    state.viewH = clamp(Math.round(h || VIEW_H), 132, 320)
    updateProjections()
  }

  function resetWorld() {
    state.segs.length = 0
    state.worldGems.length = 0
    state.hazards.length = 0
    state.boosters.length = 0
    state.worldOffsetX = 0
    state.lastX = 0
    state.lastY = 140
    state.lastM = 0
    state.chunkCounter = 0
    physSearchHint = 0
    renderSearchHint = 0

    const allowAbyss = state.obstacleMode !== 2
    const allowSaws = state.obstacleMode === 0

    addSegment(120, 0.0, false, false)
    addValleyRamp(true, allowAbyss, allowSaws)
    addPeakMountain(1, allowSaws)
    addPeakMountain(2, allowSaws)

    const startSample = sampleTerrainInto(50, terrainOutMain)
    state.bike.x = 50
    state.bike.y = startSample.y - 6
    state.bike.vx = 40
    state.bike.vy = 0
    state.bike.speed = 40
    state.bike.angle = startSample.angle
    state.bike.angVel = 0
    state.bike.wheelie = 0
    state.bike.onGround = true
    state.bike.onSteepDrop = false
    state.bike.airTime = 0
    state.bike.airRotation = 0
    state.bike.airFlips = 0
    state.camY = state.bike.y
    state.renderZoom = state.zoomScale
    updateColors(true)
    updateProjections()
  }

  function triggerCrash(reason) {
    state.status = 'gameover'
    state.crashReason = reason
    state.bannerText = reason
    state.bannerTimer = 2.0
    if (state.score > state.bestScore) state.bestScore = state.score
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

  function stepSub(dt, isPressing) {
    const b = state.bike
    const gravity = state.difficultyMode === 0 ? 430 : state.difficultyMode === 2 ? 490 : 460
    const maxSpeed = state.difficultyMode === 2 ? 305 : 285
    const crashAngleLimit =
      state.difficultyMode === 0 ? 1.32 : state.difficultyMode === 2 ? 0.94 : 1.12
    let event = null

    if (b.onGround) {
      const cur = sampleTerrainInto(b.x, terrainOutMain)
      const ahead = sampleTerrainInto(b.x + 48, terrainOutAux)
      b.onSteepDrop = cur.overSawZone || ahead.overSawZone

      if (cur.abyss && b.y > cur.lipY + 18) {
        triggerCrash('В ПРОПАСТЬ!')
        return 'crash'
      }

      const sinA = Math.sin(cur.angle)
      const cosA = Math.cos(cur.angle)

      if (isPressing) {
        const slopeAssist = sinA > 0 ? 280 * sinA : 95 * sinA
        b.speed += Math.max(130, 245 + slopeAssist) * dt
        const targetWheelie = b.speed > 135 && !b.onSteepDrop ? -0.16 : 0
        b.wheelie += (targetWheelie - b.wheelie) * Math.min(1, 10 * dt)
      } else {
        b.wheelie += (0 - b.wheelie) * Math.min(1, 14 * dt)
        if (b.onSteepDrop && sinA < 0.45 && b.speed > 35) {
          if (b.speed > 94) {
            b.speed = Math.max(92, b.speed - 480 * dt)
          } else {
            b.speed = 92
          }
        } else if (sinA > 0.22) {
          const coastTarget = 132
          if (b.speed < coastTarget) {
            b.speed = Math.min(coastTarget, b.speed + sinA * 260 * dt)
          } else {
            b.speed = Math.max(coastTarget, b.speed - 480 * dt)
          }
        } else if (sinA < -0.22) {
          b.speed += sinA * 290 * dt - (b.speed > 0 ? 45 : -45) * dt
          if (b.speed < -85) b.speed = -85
        } else {
          if (b.speed > 0) {
            b.speed = Math.max(0, b.speed - 360 * dt)
          } else if (b.speed < 0) {
            b.speed = Math.min(0, b.speed + 260 * dt)
          }
        }
      }

      if (b.speed > maxSpeed) b.speed = maxSpeed

      for (let i = 0; i < state.boosters.length; i++) {
        const bs = state.boosters[i]
        if (Math.abs(b.x - bs.x) < 18 && Math.abs(b.y - bs.y) < 18) {
          if (b.speed < 255) {
            b.speed = 255
            state.bannerText = 'УСКОРЕНИЕ!'
            state.bannerTimer = 0.55
            event = 'boost'
          }
        }
      }

      const dxMove = b.speed * cosA * dt
      const nextX = Math.max(16, b.x + dxMove)
      const probeDist = Math.max(12, Math.abs(b.speed) * dt * 1.6)
      const probe = sampleTerrainInto(nextX + (b.speed >= 0 ? probeDist : -probeDist), terrainOutAux)
      const dTheta = probe.angle - cur.angle
      const aReq = b.speed > 0 ? (b.speed * b.speed * dTheta) / probeDist : 0
      const gNorm = gravity * cosA

      if (
        (b.speed > 105 && dTheta > 0.045 && aReq > gNorm * 0.85) ||
        (probe.abyss && !cur.abyss && b.x > cur.x1 - 14 && b.speed > 20)
      ) {
        b.onGround = false
        b.onSteepDrop = false
        b.airTime = 0
        b.airRotation = 0
        b.airFlips = 0
        b.x = nextX
        const launchAngle = cur.angle + (isPressing ? b.wheelie * 0.5 : 0)
        b.vx = b.speed * Math.cos(launchAngle)
        b.vy = b.speed * Math.sin(launchAngle)
        b.angle = launchAngle
        b.y = cur.y - 6.5
        b.angVel = isPressing ? -3.2 : 0
        b.wheelie = 0
      } else {
        const next = sampleTerrainInto(nextX, terrainOutAux)
        b.x = nextX
        b.y = next.y - 6
        b.vx = b.speed * Math.cos(next.angle)
        b.vy = b.speed * Math.sin(next.angle)
        b.angle = next.angle
        b.angVel = 0
      }
    } else {
      b.onSteepDrop = false
      b.wheelie = 0
      b.airTime += dt
      b.x += b.vx * dt
      b.vy += gravity * dt
      b.y += b.vy * dt

      const maxSpin = state.turboFlip ? 12.2 : 10.6
      const spinAcc = state.turboFlip ? 46.0 : 40.0

      if (isPressing) {
        b.angVel = Math.max(-maxSpin, b.angVel - spinAcc * dt)
      } else {
        b.angVel *= Math.max(0, 1 - 14.0 * dt)
      }

      const dTheta = b.angVel * dt
      b.angle = normalizeAngle(b.angle + dTheta)
      if (dTheta < 0) {
        b.airRotation += -dTheta
        const totalFlips = Math.floor((b.airRotation + 0.90) / 6.283185307179586)
        if (totalFlips > b.airFlips) {
          b.airFlips = totalFlips
          state.score += b.airFlips
          state.bannerText = 'САЛЬТО x' + b.airFlips
          state.bannerTimer = 0.7
          event = 'flip'
        }
      }

      const ground = sampleTerrainInto(b.x, terrainOutMain)
      if (ground.abyss && b.y > ground.lipY + 20 && b.vy > 20) {
        triggerCrash('В ПРОПАСТЬ!')
        return 'crash'
      }

      if (b.y >= ground.y - 6) {
        const vNorm = b.vy * Math.cos(ground.angle) - b.vx * Math.sin(ground.angle)
        if (vNorm >= -15) {
          if (ground.abyss) {
            triggerCrash('В ПРОПАСТЬ!')
            return 'crash'
          }

          const diff = Math.abs(normalizeAngle(b.angle - ground.angle))
          if (diff > crashAngleLimit) {
            triggerCrash('РАЗБИЛСЯ!')
            return 'crash'
          }

          b.y = ground.y - 6
          b.onGround = true
          b.angle = ground.angle
          b.angVel = 0

          const vTan = b.vx * Math.cos(ground.angle) + b.vy * Math.sin(ground.angle)
          b.speed = clamp(Math.max(b.speed * 0.72, vTan * 0.98), 45, maxSpeed)

          if (b.airFlips > 0) {
            if (diff < 0.34) {
              state.combo = Math.min(5, state.combo + 1)
              const bonus = b.airFlips * 2
              state.score += bonus
              b.speed = Math.min(maxSpeed, b.speed + 45)
              state.bannerText = 'ИДЕАЛЬНО +' + bonus
              state.bannerTimer = 0.85
            } else {
              state.combo = 1
              state.score += b.airFlips
              state.bannerText = 'ЧИСТО +' + b.airFlips
              state.bannerTimer = 0.75
            }
            event = 'land'
          }
          b.airTime = 0
          b.airRotation = 0
          b.airFlips = 0
        }
      }
    }

    for (let i = 0; i < state.hazards.length; i++) {
      if (checkSawHit(b, state.hazards[i])) {
        triggerCrash('ПИЛА!')
        return 'crash'
      }
    }

    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const dx = g.x - b.x
        const dy = g.y - b.y
        if (dx * dx + dy * dy < 400) {
          g.taken = true
          state.gems += 1
          state.score += 2
          state.bannerText = 'КРИСТАЛЛ +2'
          state.bannerTimer = 0.6
          if (!event) event = 'gem'
        }
      }
    }

    return event
  }

  function step(dtInput, isPressing) {
    const dt = clamp(dtInput, 0.008, 0.045)
    let event = null

    if (state.bannerTimer > 0) {
      state.bannerTimer = Math.max(0, state.bannerTimer - dt)
      if (state.bannerTimer === 0 && state.status === 'playing') state.bannerText = ''
    }

    if (state.status !== 'playing') {
      updateProjections()
      stepResult.event = null
      return stepResult
    }

    const subSteps = dt > 0.020 ? 2 : 1
    const subDt = dt / subSteps
    for (let s = 0; s < subSteps; s++) {
      const ev = stepSub(subDt, isPressing)
      if (ev === 'crash') {
        stepResult.event = 'crash'
        return stepResult
      }
      if (ev && !event) event = ev
    }

    const b = state.bike
    const totalWorldX = state.worldOffsetX + b.x
    const distanceScore = (totalWorldX / 110) | 0
    if (distanceScore > state.score) state.score = distanceScore
    if (state.score > state.bestScore) state.bestScore = state.score

    while (state.lastX < b.x + 420) appendProceduralChunk()
    while (state.segs.length > 6 && state.segs[0].x1 < b.x - 120) {
      state.segs.shift()
      if (physSearchHint > 0) physSearchHint -= 1
      if (renderSearchHint > 0) renderSearchHint -= 1
    }
    while (state.worldGems.length > 0 && state.worldGems[0].x < b.x - 120) state.worldGems.shift()
    while (state.hazards.length > 0 && state.hazards[0].x < b.x - 120) state.hazards.shift()
    while (state.boosters.length > 0 && state.boosters[0].x < b.x - 120) state.boosters.shift()

    if (b.x > 40000) rebaseWorldCoordinates()

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
    renderSnapshot.boostX = state.boostX
    renderSnapshot.boostY = state.boostY
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
