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
    state.lastM = nextM
  }

  function appendProceduralChunk() {
    const r = nextRand()
    const allowAbyss = state.obstacleMode !== 2
    const allowSaws = state.obstacleMode === 0

    if (r < 0.25) {
      addSegment(80, 0.68, false, false, 0, false)
      addSegment(70, 0.0, false, false, 0, false)
      addSegment(85, -0.80, true, false, 0, false)
      const lipX = state.lastX
      const lipY = state.lastY
      addSegment(55, 1.02, false, allowAbyss, lipY, false)
      addSegment(55, 0.0, false, allowAbyss, lipY, false)
      const bridgeStart = state.lastX
      addSegment(80, 0.35, false, false, 0, false)
      addSegment(80, 0.0, false, false, 0, false)
      state.loops.push({
        cx: bridgeStart,
        span: 160,
        slideOffset: 64,
        switched: false,
        completed: false
      })
      state.worldGems.push({
        x: lipX + 65,
        y: lipY - 44,
        taken: false
      })
    } else if (r < 0.52) {
      addSegment(85, 0.75, false, false, 0, false)
      addSegment(70, 0.0, false, false, 0, false)
      addSegment(85, -0.80, true, false, 0, false)
      const lipX = state.lastX
      const lipY = state.lastY
      addSegment(55, 1.05, false, allowAbyss, lipY, false)
      addSegment(55, 0.0, false, allowAbyss, lipY, false)
      addSegment(75, 0.35, false, false, 0, true)
      addSegment(65, 0.0, false, false, 0, true)
      addSegment(85, -0.78, true, false, 0, true)
      const lip2Y = state.lastY
      addSegment(55, 1.02, false, allowAbyss, lip2Y, false)
      addSegment(55, 0.0, false, allowAbyss, lip2Y, false)
      addSegment(85, 0.35, false, false, 0, false)
      addSegment(75, 0.0, false, false, 0, false)
      state.worldGems.push({
        x: lipX + 65,
        y: lipY - 44,
        taken: false
      })
    } else if (r < 0.78) {
      addSegment(85, 0.72, false, false, 0, false)
      addSegment(70, 0.0, false, false, 0, false)
      addSegment(85, -0.82, true, false, 0, false)
      const lipX = state.lastX
      const lipY = state.lastY
      addSegment(58, 1.15, false, allowAbyss, lipY, false)
      const pitX = state.lastX
      const pitY = state.lastY
      addSegment(58, 0.0, false, allowAbyss, lipY, false)
      addSegment(85, 0.38, false, false, 0, false)
      addSegment(80, 0.0, false, false, 0, false)
      if (allowSaws) {
        state.hazards.push({
          x: pitX,
          y: pitY + 26,
          r: 14
        })
      }
      state.worldGems.push({
        x: lipX + 60,
        y: lipY - 46,
        taken: false
      })
    } else {
      addSegment(95, 0.85, false, false, 0, false)
      addSegment(75, 0.0, false, false, 0, false)
      addSegment(85, -0.84, true, false, 0, false)
      const lipX = state.lastX
      const lipY = state.lastY
      addSegment(56, 1.08, false, allowAbyss, lipY, false)
      const sawX = state.lastX
      const sawY = state.lastY
      addSegment(56, 0.0, false, allowAbyss, lipY, false)
      addSegment(85, 0.36, false, false, 0, false)
      addSegment(80, 0.0, false, false, 0, false)
      if (allowSaws) {
        state.hazards.push({
          x: sawX,
          y: sawY + 28,
          r: 14
        })
      }
      state.worldGems.push({
        x: lipX + 62,
        y: lipY - 48,
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

  function sampleChartY(wx) {
    let y = sampleTerrainY(wx)
    for (let i = 0; i < state.loops.length; i++) {
      const lp = state.loops[i]
      if (lp.slideOffset > 0 && wx >= lp.cx && wx <= lp.cx + lp.span) {
        const u = (wx - lp.cx) / lp.span
        const smoothBell = 0.5 * (1 - Math.cos(u * 6.283185307179586))
        y += lp.slideOffset * smoothBell
      }
    }
    return y
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
          island: s.island,
          lipY: s.lipY
        }
      }
    }
    return {
      y: state.lastY,
      m: 0,
      angle: 0,
      kicker: false,
      abyss: false,
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
    const scale = state.zoomScale
    const invScale = 1.0 / scale
    const worldLeft = b.x - BIKE_SCREEN_X * invScale
    const worldStep = POINT_STEP * invScale

    const curGround = sampleTerrain(b.x)
    const refGroundY = curGround.abyss ? curGround.lipY : curGround.y
    const focusY = b.onGround ? b.y : b.y * 0.72 + refGroundY * 0.28
    state.camY += (focusY - state.camY) * 0.24
    const camCenterY = state.camY

    for (let i = 0; i < CHART_POINTS; i++) {
      const wy = sampleChartY(worldLeft + i * worldStep)
      const sy = 156 + (wy - camCenterY) * scale
      chartData[i] = clamp(Math.round(VIEW_H - sy), 4, VIEW_H - 4)
    }

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const sx = BIKE_SCREEN_X
    const sy = clamp(156 + (b.y - camCenterY) * scale, 14, VIEW_H - 14)
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
      if (!g.taken) {
        const scX = Math.round(sx + (g.x - b.x) * scale - 5)
        const scY = Math.round(156 + (g.y - camCenterY) * scale - 5)
        if (scX >= -12 && scX <= VIEW_W + 12 && scY >= 4 && scY <= VIEW_H - 10) {
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
      const scX = Math.round(sx + (h.x - b.x) * scale - 13)
      const scY = Math.round(156 + (h.y - camCenterY) * scale - 13)
      if (scX >= -26 && scX <= VIEW_W + 26 && scY >= -20 && scY <= VIEW_H + 10) {
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
    state.loops = []
    state.worldGems = []
    state.hazards = []
    state.lastX = 0
    state.lastY = 180
    state.lastM = 0
    searchHint = 0

    const allowAbyss = state.obstacleMode !== 2
    const allowSaws = state.obstacleMode === 0

    addSegment(80, 0.0, false, false, 0, false)
    addSegment(85, 0.72, false, false, 0, false)
    addSegment(75, 0.0, false, false, 0, false)
    addSegment(85, -0.78, true, false, 0, false)
    const firstLipX = state.lastX
    const firstLipY = state.lastY
    addSegment(55, 0.92, false, allowAbyss, firstLipY, false)
    addSegment(55, 0.0, false, allowAbyss, firstLipY, false)
    if (allowSaws) {
      state.hazards.push({
        x: firstLipX + 55,
        y: firstLipY + 34,
        r: 14
      })
    }
    const bridgeStart = state.lastX
    addSegment(80, 0.35, false, false, 0, false)
    addSegment(75, 0.0, false, false, 0, false)
    state.loops.push({
      cx: bridgeStart,
      span: 155,
      slideOffset: 64,
      switched: false,
      completed: false
    })
    state.worldGems.push({
      x: firstLipX + 60,
      y: firstLipY - 42,
      taken: false
    })

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
    state.bike.inLoop = false
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
    state.bike.inLoop = false
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

    for (let i = 0; i < state.loops.length; i++) {
      const lp = state.loops[i]
      if (!lp.switched && b.x >= lp.cx - 115) {
        lp.switched = true
      }
      if (lp.switched && lp.slideOffset > 0) {
        lp.slideOffset = Math.max(0, lp.slideOffset - 240 * dt)
      }
      if (!lp.completed && b.x >= lp.cx + 25) {
        lp.completed = true
        state.score += 5
        state.bannerText = 'ПЕТЛЯ +5'
        state.bannerTimer = 0.85
        if (!event) event = 'flip'
      }
    }

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

      b.speed = clamp(b.speed, 38, maxSpeed)

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
        if (diff > crashAngleLimit) {
          triggerCrash('РАЗБИЛСЯ!')
          return { event: 'crash' }
        }

        b.y = ground.y - 6
        b.onGround = true
        b.angle = ground.angle
        b.angVel = 0

        const impactSpeed = Math.hypot(b.vx, b.vy)
        b.speed = clamp(Math.max(b.speed, impactSpeed * 0.88), 110, maxSpeed)

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
      if (dx * dx + dy * dy < 260) {
        triggerCrash('ПИЛА!')
        return { event: 'crash' }
      }
    }

    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const dx = g.x - b.x
        const dy = g.y - b.y
        if (dx * dx + dy * dy < 440) {
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

    while (state.lastX < b.x + 520) {
      appendProceduralChunk()
    }
    while (state.segs.length > 8 && state.segs[0].x1 < b.x - 180) {
      state.segs.shift()
      if (searchHint > 0) searchHint -= 1
    }
    while (state.loops.length > 0 && state.loops[0].cx + state.loops[0].span < b.x - 150) {
      state.loops.shift()
    }
    while (state.worldGems.length > 0 && state.worldGems[0].x < b.x - 120) {
      state.worldGems.shift()
    }
    while (state.hazards.length > 0 && state.hazards[0].x < b.x - 120) {
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
