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
    state.lastM = nextM
  }

  function addAbyss(dx, nextY, nextM) {
    const x0 = state.lastX
    const y0 = state.lastY
    const x1 = x0 + dx
    const lipY = Math.max(y0, nextY)
    state.segs.push({
      x0,
      x1,
      y0: lipY + 260,
      y1: lipY + 260,
      m0: 0,
      m1: 0,
      dm: 0,
      invDx: 1.0 / dx,
      c1: 0,
      c2: 0,
      kicker: false,
      abyss: true,
      island: false,
      lipY
    })
    state.lastX = x1
    state.lastY = nextY
    state.lastM = nextM
  }

  function appendProceduralChunk() {
    const r = nextRand()

    if (r < 0.22) {
      addSegment(80, 0.55, false, false, 0, false)
      addSegment(85, 0.0, false, false, 0, false)
      const loopCX = state.lastX + 48
      const entryY = state.lastY
      const loopR = 44
      const loopCY = entryY - loopR
      addSegment(105, 0.0, false, false, 0, false)
      addSegment(80, 0.28, false, false, 0, false)
      addSegment(75, 0.0, false, false, 0, false)
      state.loops.push({
        cx: loopCX,
        cy: loopCY,
        r: loopR,
        entryY,
        slideOffset: 56,
        switched: false,
        completed: false
      })
      state.worldGems.push({
        x: loopCX,
        y: loopCY - loopR + 10,
        taken: false
      })
    } else if (r < 0.46) {
      addSegment(85, 0.72, false, false, 0, false)
      addSegment(70, 0.0, false, false, 0, false)
      addSegment(85, -0.80, true, false, 0, false)
      const lipX = state.lastX
      const lipY = state.lastY
      addAbyss(62, lipY + 12, -0.35)
      addSegment(48, 0.0, false, false, 0, true)
      addSegment(48, -0.68, true, false, 0, true)
      const islandLipY = state.lastY
      addAbyss(64, islandLipY + 36, 0.35)
      addSegment(90, 0.35, false, false, 0, false)
      addSegment(85, 0.0, false, false, 0, false)
      state.worldGems.push({
        x: lipX + 110,
        y: lipY - 38,
        taken: false
      })
    } else if (r < 0.70) {
      addSegment(85, 0.75, false, false, 0, false)
      addSegment(70, 0.0, false, false, 0, false)
      addSegment(85, -0.82, true, false, 0, false)
      const lipX = state.lastX
      const lipY = state.lastY
      addAbyss(84, lipY + 44, 0.35)
      addSegment(90, 0.35, false, false, 0, false)
      addSegment(85, 0.0, false, false, 0, false)
      state.hazards.push({
        x: lipX + 42,
        y: lipY + 26,
        r: 14
      })
      state.worldGems.push({
        x: lipX + 42,
        y: lipY - 46,
        taken: false
      })
    } else {
      addSegment(80, 0.65, false, false, 0, false)
      addSegment(65, 0.0, false, false, 0, false)
      addSegment(80, -0.78, true, false, 0, false)
      const kickX = state.lastX
      const kickY = state.lastY
      addSegment(50, 0.75, false, false, 0, false)
      const sawX = state.lastX
      const sawY = state.lastY
      addSegment(50, 0.0, false, false, 0, false)
      addSegment(85, 0.32, false, false, 0, false)
      addSegment(80, 0.0, false, false, 0, false)
      state.hazards.push({
        x: sawX,
        y: sawY + 8,
        r: 14
      })
      state.worldGems.push({
        x: kickX + 50,
        y: kickY - 42,
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
      const dx = wx - lp.cx
      if (dx >= -lp.r && dx <= lp.r * 1.5 && lp.slideOffset > 0) {
        if (dx >= -lp.r * 0.5 && dx <= lp.r * 0.7) {
          const norm = (dx + lp.r * 0.5) / (lp.r * 1.2)
          const arcLift = Math.sin(norm * 3.141592653589793) * (lp.r * 1.5)
          y -= arcLift * (lp.slideOffset / 56)
        } else if (dx > lp.r * 0.7) {
          const tail = 1 - (dx - lp.r * 0.7) / (lp.r * 0.8)
          y -= lp.slideOffset * clamp(tail, 0, 1)
        }
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
          kicker: s.kicker && u > 0.82,
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

  let pulseTick = 0

  function updateColors() {
    state.trackColor = computeRainbowTrackColor(state.bike.x)
    pulseTick = (pulseTick + 1) % 8
    state.sawColor = pulseTick < 4 ? '#FF1744' : '#FF5252'
  }

  function updateProjections() {
    const b = state.bike
    const baseOffset = state.farCam ? 34 : BIKE_SCREEN_X
    const targetCamX =
      b.inLoop && b.activeLoop ? b.activeLoop.cx - 88 : b.x - baseOffset

    if (Math.abs(targetCamX - state.camX) > 90) {
      state.camX = targetCamX
    } else {
      state.camX += (targetCamX - state.camX) * 0.32
    }

    const worldLeft = state.camX
    const curGround = sampleTerrain(b.x)
    const refGroundY = curGround.abyss ? curGround.lipY : curGround.y
    const focusY = b.onGround || b.inLoop ? b.y : b.y * 0.72 + refGroundY * 0.28
    const targetCamY = focusY - 156
    state.camY += (targetCamY - state.camY) * 0.24
    const camY = state.camY

    for (let i = 0; i < CHART_POINTS; i++) {
      const sy = sampleChartY(worldLeft + i * POINT_STEP) - camY
      chartData[i] = clamp(Math.round(VIEW_H - sy), 4, VIEW_H - 4)
    }

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const sx = clamp(b.x - worldLeft, 14, VIEW_W - 14)
    const sy = clamp(b.y - camY, 12, VIEW_H - 12)

    b.rx = Math.round(sx - cosA * 10 - 6)
    b.ry = Math.round(sy - sinA * 10 - 6)
    b.cx = Math.round(sx + sinA * 5 - 6)
    b.cy = Math.round(sy - cosA * 5 - 5)
    b.fx = Math.round(sx + cosA * 10 - 6)
    b.fy = Math.round(sy + sinA * 10 - 6)

    let gx = -40
    let gy = -40
    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const scX = Math.round(g.x - worldLeft - 5)
        const scY = Math.round(g.y - camY - 5)
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
      const scX = Math.round(h.x - worldLeft - 14)
      const scY = Math.round(h.y - camY - 14)
      if (scX >= -28 && scX <= VIEW_W + 28 && scY >= -20 && scY <= VIEW_H + 10) {
        hx = scX
        hy = scY
        break
      }
    }
    state.hazX = hx
    state.hazY = hy

    let lx = -140
    let ly = -140
    for (let i = 0; i < state.loops.length; i++) {
      const lp = state.loops[i]
      const scX = Math.round(lp.cx - worldLeft - lp.r)
      const scY = Math.round(lp.cy - camY - lp.r)
      if (scX >= -95 && scX <= VIEW_W + 20) {
        lx = scX
        ly = scY
        break
      }
    }
    state.loopX = lx
    state.loopY = ly
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

    addSegment(80, 0.0, false, false, 0, false)
    addSegment(85, 0.72, false, false, 0, false)
    addSegment(75, 0.0, false, false, 0, false)
    addSegment(85, -0.78, true, false, 0, false)
    const firstLipX = state.lastX
    const firstLipY = state.lastY
    addAbyss(100, firstLipY + 48, 0.35)
    state.hazards.push({
      x: firstLipX + 50,
      y: firstLipY + 28,
      r: 14
    })
    addSegment(85, 0.35, false, false, 0, false)
    addSegment(80, 0.0, false, false, 0, false)

    const loopCX = state.lastX + 48
    const entryY = state.lastY
    const loopR = 44
    const loopCY = entryY - loopR
    addSegment(105, 0.0, false, false, 0, false)
    addSegment(80, 0.28, false, false, 0, false)
    addSegment(75, 0.0, false, false, 0, false)
    state.loops.push({
      cx: loopCX,
      cy: loopCY,
      r: loopR,
      entryY,
      slideOffset: 56,
      switched: false,
      completed: false
    })
    state.worldGems.push({
      x: loopCX,
      y: loopCY - loopR + 10,
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
    state.bike.activeLoop = null
    state.bike.loopAngle = 0
    state.bike.airTime = 0
    state.bike.airRotation = 0
    state.bike.airFlips = 0
    state.camX = state.bike.x - (state.farCam ? 34 : BIKE_SCREEN_X)
    state.camY = state.bike.y - 156
    updateColors()
    updateProjections()
  }

  function triggerCrash(reason) {
    state.status = 'gameover'
    state.crashReason = reason
    state.bannerText = reason
    state.bannerTimer = 2.0
    state.bike.inLoop = false
    state.bike.activeLoop = null
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

    for (let i = 0; i < state.loops.length; i++) {
      const lp = state.loops[i]
      if (lp.switched && lp.slideOffset > 0) {
        lp.slideOffset = Math.max(0, lp.slideOffset - 260 * dt)
      }
    }

    const b = state.bike
    const gravity = 510

    if (b.inLoop && b.activeLoop) {
      const lp = b.activeLoop
      if (isPressing) {
        b.speed = clamp(b.speed + 250 * dt, 135, 265)
      } else {
        b.speed = clamp(b.speed - Math.sin(b.loopAngle) * 150 * dt, 115, 260)
      }
      const effR = lp.r - 6
      const omega = (b.speed / effR) * 1.08
      b.loopAngle += omega * dt
      if (b.loopAngle >= 2.1) {
        lp.switched = true
      }
      if (b.loopAngle >= 6.283185307179586) {
        b.inLoop = false
        b.activeLoop = null
        lp.completed = true
        lp.switched = true
        lp.slideOffset = 0
        b.x = lp.cx + 16
        const exitG = sampleTerrain(b.x)
        b.y = exitG.y - 6
        b.angle = exitG.angle
        b.onGround = true
        b.angVel = 0
        b.speed = Math.max(b.speed, 195)
        state.score += 5
        state.bannerText = 'ПЕТЛЯ +5'
        state.bannerTimer = 0.85
        event = 'flip'
      } else {
        b.x = lp.cx + Math.sin(b.loopAngle) * effR
        b.y = lp.cy + Math.cos(b.loopAngle) * effR
        b.angle = normalizeAngle(-b.loopAngle)
        b.vx = b.speed * Math.cos(b.angle)
        b.vy = b.speed * Math.sin(b.angle)
      }
    } else if (b.onGround) {
      for (let i = 0; i < state.loops.length; i++) {
        const lp = state.loops[i]
        if (!lp.completed && b.x >= lp.cx - 12 && b.x <= lp.cx + 14 && b.speed >= 85) {
          b.inLoop = true
          b.activeLoop = lp
          b.loopAngle = 0
          b.speed = Math.max(b.speed, 175)
          break
        }
      }

      if (!b.inLoop) {
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
          const launchAngle = clamp(cur.angle, -0.78, -0.32)
          b.x = nextX
          const minVx = isPressing || b.speed > 110 ? 135 : 52
          b.vx = clamp(b.speed * Math.cos(launchAngle), minVx, 225)
          b.vy =
            b.speed * Math.sin(launchAngle) -
            (isPressing || b.speed > 165 ? 38 : 10)
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
        if (b.airFlips > 0) {
          const gTarget = sampleTerrain(b.x)
          const targetAngle = gTarget.abyss ? 0.25 : gTarget.angle
          b.angle += normalizeAngle(targetAngle - b.angle) * Math.min(1, 9.0 * dt)
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

    if (!b.inLoop) {
      for (let i = 0; i < state.hazards.length; i++) {
        const h = state.hazards[i]
        const dx = h.x - b.x
        const dy = h.y - b.y
        if (dx * dx + dy * dy < 360) {
          triggerCrash('ПИЛА!')
          return { event: 'crash' }
        }
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

    while (state.lastX < b.x + 480) {
      appendProceduralChunk()
    }
    while (state.segs.length > 8 && state.segs[0].x1 < b.x - 180) {
      state.segs.shift()
      if (searchHint > 0) searchHint -= 1
    }
    while (state.loops.length > 0 && state.loops[0].cx + state.loops[0].r < b.x - 150) {
      state.loops.shift()
    }
    while (state.worldGems.length > 0 && state.worldGems[0].x < b.x - 120) {
      state.worldGems.shift()
    }
    while (state.hazards.length > 0 && state.hazards[0].x < b.x - 120) {
      state.hazards.shift()
    }

    updateColors()
    updateProjections()
    return { event }
  }

  function getRenderSnapshot() {
    return {
      status: state.status,
      crashReason: state.crashReason,
      trackColor: state.trackColor,
      sawColor: state.sawColor,
      score: state.score,
      bestScore: state.bestScore,
      gems: state.gems,
      bannerText: state.bannerText,
      bike: state.bike,
      chartData: state.chartData,
      gemX: state.gemX,
      gemY: state.gemY,
      hazX: state.hazX,
      hazY: state.hazY,
      loopX: state.loopX,
      loopY: state.loopY
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
