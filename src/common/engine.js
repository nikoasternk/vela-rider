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
    gem2X: -40,
    gem2Y: -40,
    hazX: -50,
    hazY: -50,
    haz2X: -50,
    haz2Y: -50,
    chartData
  }

  function addSegment(dx, nextM, isKicker, isSteepDrop, isIsland) {
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
      abyss: false,
      steepDrop: Boolean(isSteepDrop),
      island: Boolean(isIsland),
      lipY: y0
    })
    state.lastX = x1
    state.lastY = y1
    state.lastM = nextM
  }

  function addAbyss(dx, dyLanding, allowAbyss, allowSaws, withSaw, withGem) {
    if (!allowAbyss) {
      addSegment(dx * 0.5, 0.35, false, false, false)
      addSegment(dx * 0.5, 0.0, false, false, false)
      return
    }
    const x0 = state.lastX
    const y0 = state.lastY
    const x1 = x0 + dx
    const y1 = y0 + dyLanding
    const mLinear = dyLanding / dx
    const lipY = Math.max(y0, y1)
    state.segs.push({
      x0,
      x1,
      dx,
      y0,
      y1,
      m0: mLinear,
      m1: mLinear,
      dm: 0,
      invDx: 1.0 / dx,
      c1: dyLanding,
      c2: 0,
      kicker: false,
      abyss: true,
      steepDrop: false,
      island: false,
      lipY
    })
    if (allowSaws && withSaw) {
      state.hazards.push({
        x: x0 + dx * 0.5,
        y: lipY + 24,
        r: 14
      })
    }
    if (withGem) {
      state.worldGems.push({
        x: x0 + dx * 0.5,
        y: Math.min(y0, y1) - 42,
        taken: false
      })
    }
    state.lastX = x1
    state.lastY = y1
    state.lastM = 0.12
  }

  function addSmallIsland(width, kickSlope, withGem) {
    const landW = Math.round(width * 0.42)
    const kickW = width - landW
    const xMid = state.lastX + landW
    const yMid = state.lastY
    addSegment(landW, 0.0, false, false, true)
    addSegment(kickW, kickSlope, true, false, true)
    if (withGem) {
      state.worldGems.push({
        x: xMid,
        y: yMid - 26,
        taken: false
      })
    }
  }

  function addIslandChain(islandCount, allowAbyss, allowSaws) {
    for (let i = 0; i < islandCount; i++) {
      addAbyss(98, 14, allowAbyss, allowSaws, i % 2 === 0, true)
      addSmallIsland(76, -0.78, i % 2 === 1)
    }
    addAbyss(98, 14, allowAbyss, allowSaws, true, true)
    addSegment(85, 0.22, false, false, false)
    addSegment(70, 0.0, false, false, false)
  }

  function addMountainSteepDescent(allowSaws, doubleTier) {
    addSegment(125, -1.18, false, false, false)
    addSegment(95, -0.92, false, false, false)
    addSegment(54, 0.0, false, false, false)
    state.worldGems.push({
      x: state.lastX - 18,
      y: state.lastY - 22,
      taken: false
    })

    const crest1X = state.lastX
    const crest1Y = state.lastY
    addSegment(46, 1.48, false, true, false)
    addSegment(125, 1.48, false, true, false)
    if (allowSaws) {
      state.hazards.push({
        x: crest1X + 68,
        y: crest1Y + 22,
        r: 14
      })
    }
    state.worldGems.push({
      x: crest1X + 115,
      y: state.lastY - 28,
      taken: false
    })

    if (doubleTier) {
      addSegment(64, 0.0, false, false, false)
      const crest2X = state.lastX
      const crest2Y = state.lastY
      addSegment(46, 1.48, false, true, false)
      addSegment(120, 1.48, false, true, false)
      if (allowSaws) {
        state.hazards.push({
          x: crest2X + 68,
          y: crest2Y + 22,
          r: 14
        })
      }
    }

    addSegment(85, 0.30, false, false, false)
    addSegment(75, 0.0, false, false, false)
  }

  function appendProceduralChunk() {
    const allowAbyss = state.obstacleMode !== 2
    const allowSaws = state.obstacleMode === 0
    const pattern = (state.chunkCounter + ((nextRand() * 2) | 0)) % 6
    state.chunkCounter += 1

    if (pattern === 0) {
      addSegment(80, -0.78, true, false, false)
      addIslandChain(2, allowAbyss, allowSaws)
    } else if (pattern === 1) {
      addMountainSteepDescent(allowSaws, false)
      addSegment(82, -0.80, true, false, false)
      addIslandChain(1, allowAbyss, allowSaws)
    } else if (pattern === 2) {
      addSegment(82, -0.78, true, false, false)
      addIslandChain(3, allowAbyss, allowSaws)
    } else if (pattern === 3) {
      addMountainSteepDescent(allowSaws, true)
      addSegment(85, -0.82, true, false, false)
      addAbyss(98, 12, allowAbyss, allowSaws, true, true)
      addSegment(85, 0.25, false, false, false)
      addSegment(70, 0.0, false, false, false)
    } else if (pattern === 4) {
      addSegment(115, -1.12, false, false, false)
      addSegment(55, 0.0, false, false, false)
      const cX = state.lastX
      const cY = state.lastY
      addSegment(46, 1.48, false, true, false)
      addSegment(118, 1.48, false, true, false)
      if (allowSaws) {
        state.hazards.push({
          x: cX + 68,
          y: cY + 22,
          r: 14
        })
      }
      addSegment(75, 0.0, false, false, false)
      addSegment(82, -0.80, true, false, false)
      addIslandChain(2, allowAbyss, allowSaws)
    } else {
      addMountainSteepDescent(allowSaws, false)
      addSegment(80, -0.78, true, false, false)
      addIslandChain(3, allowAbyss, allowSaws)
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

  function sampleVisualY(wx) {
    const segs = state.segs
    const len = segs.length
    if (searchHint >= len) searchHint = 0
    let idx = searchHint
    if (wx < segs[idx].x0) idx = 0
    const pitDepth = Math.min(84, Math.round(state.viewH * 0.28))
    for (let i = idx; i < len; i++) {
      const s = segs[i]
      if (wx <= s.x1 || i === len - 1) {
        searchHint = i
        const localX = clamp(wx - s.x0, 0, s.dx)
        if (s.abyss) {
          const wallW = 42
          const abyssFloor = s.lipY + pitDepth
          if (localX < wallW) {
            const t = localX / wallW
            const sc = t * t * (3 - 2 * t)
            return s.y0 + (abyssFloor - s.y0) * sc
          }
          const rem = s.dx - localX
          if (rem < wallW) {
            const t = rem / wallW
            const sc = t * t * (3 - 2 * t)
            return s.y1 + (abyssFloor - s.y1) * sc
          }
          return abyssFloor
        }
        const u = localX * s.invDx
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
          x0: s.x0,
          x1: s.x1,
          y,
          m,
          angle: Math.atan2(m, 1),
          kicker: s.kicker && u > 0.86,
          abyss: s.abyss,
          steepDrop: s.steepDrop,
          island: s.island,
          lipY: s.lipY
        }
      }
    }
    return {
      x0: 0,
      x1: 100,
      y: state.lastY,
      m: 0,
      angle: 0,
      kicker: false,
      abyss: false,
      steepDrop: false,
      island: false,
      lipY: 0
    }
  }

  let colorTick = 0

  function updateColors(force) {
    colorTick = (colorTick + 1) % 3
    if (force || colorTick === 0) {
      state.trackColor = computeRainbowTrackColor(state.bike.x)
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
    const filterDelta = worldStep * 0.44

    const groundAtBike = sampleTerrainY(b.x)
    const lookaheadY = sampleTerrainY(b.x + 52)
    const focusY = b.onGround
      ? b.y * 0.76 + lookaheadY * 0.24
      : b.y * 0.64 + groundAtBike * 0.22 + lookaheadY * 0.14
    state.camY += (focusY - state.camY) * 0.24
    const camCenterY = state.camY

    for (let i = 0; i < CHART_POINTS; i++) {
      const wx = worldLeft + i * worldStep
      const wy =
        sampleVisualY(wx - filterDelta) * 0.25 +
        sampleVisualY(wx) * 0.5 +
        sampleVisualY(wx + filterDelta) * 0.25
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

    let g1x = -40
    let g1y = -40
    let g2x = -40
    let g2y = -40
    let gCount = 0
    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const scX = Math.round(sx + (g.x - b.x) * scale - 5)
        const scY = Math.round(centerY + (g.y - camCenterY) * scale - 5)
        if (scX >= -10 && scX <= vw + 12 && scY >= 4 && scY <= vh - 10) {
          if (gCount === 0) {
            g1x = scX
            g1y = scY
            gCount = 1
          } else {
            g2x = scX
            g2y = scY
            break
          }
        }
      }
    }
    state.gemX = g1x
    state.gemY = g1y
    state.gem2X = g2x
    state.gem2Y = g2y

    let h1x = -50
    let h1y = -50
    let h2x = -50
    let h2y = -50
    let hCount = 0
    for (let i = 0; i < state.hazards.length; i++) {
      const h = state.hazards[i]
      const scX = Math.round(sx + (h.x - b.x) * scale - 13)
      const scY = Math.round(centerY + (h.y - camCenterY) * scale - 13)
      if (scX >= -20 && scX <= vw + 24 && scY >= -20 && scY <= vh + 10) {
        if (hCount === 0) {
          h1x = scX
          h1y = scY
          hCount = 1
        } else {
          h2x = scX
          h2y = scY
          break
        }
      }
    }
    state.hazX = h1x
    state.hazY = h1y
    state.haz2X = h2x
    state.haz2Y = h2y
  }

  function setViewport(w, h) {
    state.viewW = clamp(Math.round(w || VIEW_W), 160, 260)
    state.viewH = clamp(Math.round(h || VIEW_H), 140, 360)
    updateProjections()
  }

  function resetWorld() {
    state.segs = []
    state.worldGems = []
    state.hazards = []
    state.lastX = 0
    state.lastY = 180
    state.lastM = 0
    state.chunkCounter = 0
    searchHint = 0

    const allowAbyss = state.obstacleMode !== 2
    const allowSaws = state.obstacleMode === 0

    addSegment(65, 0.0, false, false, false)
    addSegment(80, -0.78, true, false, false)
    addIslandChain(1, allowAbyss, allowSaws)
    addMountainSteepDescent(allowSaws, false)

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
    const gravity = state.difficultyMode === 0 ? 480 : 510
    const maxSpeed = state.difficultyMode === 2 ? 295 : 275
    const crashAngleLimit =
      state.difficultyMode === 0 ? 1.35 : state.difficultyMode === 2 ? 0.96 : 1.12

    if (b.onGround) {
      const cur = sampleTerrain(b.x)
      const ahead = sampleTerrain(b.x + 28)
      b.onSteepDrop = cur.steepDrop || ahead.steepDrop

      if (cur.abyss && b.y > cur.lipY + 24) {
        triggerCrash('В ПРОПАСТЬ!')
        return { event: 'crash' }
      }

      if (isPressing) {
        if (b.speed < 148) {
          b.speed += 450 * dt
        }
        const uphillBoost = cur.angle < 0 ? -Math.sin(cur.angle) * 120 : 0
        const downhillBoost = cur.angle > 0 ? Math.sin(cur.angle) * 215 : 0
        b.speed += (275 + uphillBoost + downhillBoost) * dt
      } else {
        const slopeGravity = Math.sin(cur.angle) * 240
        b.speed += slopeGravity * dt
        b.speed *= 1 - 0.38 * dt
        if (cur.steepDrop && b.speed > 158) {
          b.speed = 158
        }
      }

      b.speed = clamp(b.speed, 38, maxSpeed)

      const stepDist = b.speed * dt
      const nextX = b.x + Math.max(1.2, stepDist * Math.cos(cur.angle * 0.65))
      const next = sampleTerrain(nextX)

      if (cur.steepDrop && isPressing && b.speed > 130 && b.x < cur.x0 + 38) {
        b.onGround = false
        b.onSteepDrop = false
        b.airTime = 0
        b.airRotation = 0
        b.airFlips = 0
        b.x = nextX
        b.vx = clamp(b.speed, 168, 202)
        b.vy = -12
        b.y = cur.y - 6
        b.angVel = -2.4
      } else if ((cur.kicker && b.speed > 115) || (next.abyss && !cur.abyss)) {
        b.onGround = false
        b.onSteepDrop = false
        b.airTime = 0
        b.airRotation = 0
        b.airFlips = 0
        b.x = nextX
        if (b.speed < 115 && !isPressing) {
          b.vx = b.speed * Math.cos(cur.angle)
          b.vy = b.speed * Math.sin(cur.angle)
          b.y = cur.y - 6
          b.angVel = 0
        } else {
          const launchAngle = clamp(cur.angle, -0.78, -0.52)
          const effSpeed = Math.max(b.speed, cur.island ? 176 : 168)
          b.vx = clamp(effSpeed * Math.cos(launchAngle) * 1.18, 162, 225)
          b.vy = Math.min(-162, effSpeed * Math.sin(launchAngle) * 1.22 - 28)
          b.y = cur.y - 7
          b.angVel = isPressing ? -2.5 : 0
        }
      } else {
        b.x = nextX
        b.y = next.y - 6
        b.vx = b.speed * Math.cos(next.angle)
        b.vy = b.speed * Math.sin(next.angle)
        const wheelieOffset = isPressing && b.speed > 195 && !cur.steepDrop ? -0.14 : 0
        b.angle = next.angle + wheelieOffset
        b.angVel = 0
      }
    } else {
      b.onSteepDrop = false
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
      if (ground.abyss && b.y > ground.lipY + 36 && b.vy > 40) {
        triggerCrash('В ПРОПАСТЬ!')
        return { event: 'crash' }
      }

      if (b.y >= ground.y - 6 && b.vy >= -10) {
        if (ground.abyss) {
          triggerCrash('В ПРОПАСТЬ!')
          return { event: 'crash' }
        }

        const diff = Math.abs(normalizeAngle(b.angle - ground.angle))
        if (diff > crashAngleLimit) {
          triggerCrash('РАЗБИЛСЯ!')
          return { event: 'crash' }
        }

        b.y = ground.y - 6
        b.onGround = true
        b.angle = ground.angle
        b.angVel = 0

        const impactSpeed = Math.hypot(b.vx, b.vy)
        const minLandSpeed = ground.island ? 162 : 120
        b.speed = clamp(Math.max(b.speed, impactSpeed * 0.88), minLandSpeed, maxSpeed)

        if (b.airFlips > 0) {
          if (diff < 0.35) {
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
      const h = state.hazards[i]
      const dx = h.x - b.x
      const dy = h.y - b.y
      if (dx * dx + dy * dy < 210) {
        triggerCrash('ПИЛА!')
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

    while (state.lastX < b.x + 620) {
      appendProceduralChunk()
    }
    while (state.segs.length > 8 && state.segs[0].x1 < b.x - 180) {
      state.segs.shift()
      if (searchHint > 0) searchHint -= 1
    }
    while (state.worldGems.length > 0 && state.worldGems[0].x < b.x - 140) {
      state.worldGems.shift()
    }
    while (state.hazards.length > 0 && state.hazards[0].x < b.x - 140) {
      state.hazards.shift()
    }

    updateColors(false)
    updateProjections()
    return { event }
  }

  function getRenderSnapshot() {
    return {
      status: state.status,
      crashReason: state.crashReason,
      trackColor: state.trackColor,
      score: state.score,
      bestScore: state.bestScore,
      gems: state.gems,
      bannerText: state.bannerText,
      bike: state.bike,
      chartData: state.chartData,
      gemX: state.gemX,
      gemY: state.gemY,
      gem2X: state.gem2X,
      gem2Y: state.gem2Y,
      hazX: state.hazX,
      hazY: state.hazY,
      haz2X: state.haz2X,
      haz2Y: state.haz2Y
    }
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
