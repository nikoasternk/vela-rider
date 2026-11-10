export const VIEW_W = 210
export const VIEW_H = 290
export const SLICE_COUNT = 35
export const SLICE_STEP = 6
export const BIKE_SCREEN_X = 52

export const THEMES = [
  {
    name: 'CYBER',
    track: '#00F0FF',
    bike: '#FF0055',
    wheel: '#00F0FF',
    visor: '#FFD700'
  },
  {
    name: 'SYNTH',
    track: '#FF007F',
    bike: '#00F0FF',
    wheel: '#FF007F',
    visor: '#FFFFFF'
  },
  {
    name: 'VENOM',
    track: '#00FF66',
    bike: '#BC13FE',
    wheel: '#00FF66',
    visor: '#FFFF00'
  },
  {
    name: 'SOLAR',
    track: '#FFB800',
    bike: '#00E5FF',
    wheel: '#FFB800',
    visor: '#FFFFFF'
  }
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

export function createGameEngine(initialSeed = 20261110) {
  let rngState = initialSeed >>> 0

  function nextRand() {
    rngState ^= rngState << 13
    rngState ^= rngState >>> 17
    rngState ^= rngState << 5
    return (rngState >>> 0) / 4294967296
  }

  const sliceY = new Int16Array(SLICE_COUNT)
  for (let i = 0; i < SLICE_COUNT; i++) {
    sliceY[i] = 190
  }

  const state = {
    status: 'menu',
    themeIdx: 0,
    score: 0,
    bestScore: 0,
    gems: 0,
    combo: 1,
    bannerText: 'HOLD TO RIDE',
    bannerTimer: 0,
    camY: 0,
    nodes: [],
    worldGems: [],
    hazards: [],
    bike: {
      x: 48,
      y: 184,
      vx: 0,
      vy: 0,
      speed: 0,
      angle: 0,
      angVel: 0,
      onGround: true,
      airRotation: 0,
      airFlips: 0,
      rx: 38,
      ry: 184,
      r2x: 43,
      r2y: 184,
      cx: 48,
      cy: 184,
      f2x: 53,
      f2y: 184,
      fx: 58,
      fy: 184,
      vxVisor: 48,
      vyVisor: 175
    },
    gemX: -30,
    gemY: -30,
    hazX: -30,
    hazY: -30,
    p0x: -30,
    p0y: -30,
    p1x: -30,
    p1y: -30,
    p0wx: 0,
    p0wy: 0,
    p0vx: 0,
    p0vy: 0,
    p0life: 0,
    p1wx: 0,
    p1wy: 0,
    p1vx: 0,
    p1vy: 0,
    p1life: 0,
    sliceY
  }

  function addNode(x, y, smooth, gap) {
    state.nodes.push({
      x,
      y: clamp(y, 82, 248),
      smooth: Boolean(smooth),
      gap: Boolean(gap)
    })
  }

  function appendProceduralChunk() {
    const last = state.nodes[state.nodes.length - 1]
    const x0 = last.x
    const y0 = last.y
    const r = nextRand()

    if (r < 0.32) {
      const amp = 36 + nextRand() * 32
      const w1 = 78 + nextRand() * 28
      const w2 = 82 + nextRand() * 28
      const yValley = clamp(y0 + amp, 135, 242)
      const yCrest = clamp(yValley - amp * 1.4, 92, 198)
      addNode(x0 + w1, yValley, true, false)
      addNode(x0 + w1 + w2, yCrest, true, false)
      addNode(x0 + w1 + w2 + 72, clamp(yCrest + 30, 128, 228), true, false)
      state.worldGems.push({
        x: x0 + w1 + w2 + 18,
        y: yCrest - 34,
        taken: false
      })
    } else if (r < 0.62) {
      const dipY = clamp(y0 + 38, 148, 242)
      const lipY = clamp(dipY - 56, 98, 188)
      const gapW = 48 + nextRand() * 22
      const catchY = clamp(lipY + 28, 132, 228)
      addNode(x0 + 64, dipY, true, false)
      addNode(x0 + 124, lipY, true, true)
      addNode(x0 + 124 + gapW, catchY, true, false)
      addNode(x0 + 194 + gapW, clamp(catchY + 20, 142, 232), true, false)
      state.worldGems.push({
        x: x0 + 124 + gapW * 0.5,
        y: lipY - 46,
        taken: false
      })
    } else if (r < 0.84) {
      const plungeY = clamp(y0 + 62, 172, 246)
      const peakY = clamp(plungeY - 80, 90, 172)
      addNode(x0 + 82, plungeY, true, false)
      addNode(x0 + 162, peakY, true, false)
      addNode(x0 + 238, clamp(peakY + 46, 138, 228), true, false)
      state.worldGems.push({
        x: x0 + 178,
        y: peakY - 48,
        taken: false
      })
    } else {
      const flatY = clamp(y0, 140, 218)
      const kickerY = clamp(flatY - 28, 112, 190)
      addNode(x0 + 54, flatY, true, false)
      addNode(x0 + 92, kickerY, true, false)
      addNode(x0 + 148, flatY, true, false)
      addNode(x0 + 210, clamp(flatY + 16, 142, 228), true, false)
      state.hazards.push({
        x: x0 + 122,
        y: flatY - 12
      })
      state.worldGems.push({
        x: x0 + 122,
        y: kickerY - 42,
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

    if (a.gap) {
      return { y: 9999, angle: 0, gap: true }
    }

    if (a.smooth) {
      const mu = (1 - Math.cos(3.141592653589793 * u)) * 0.5
      const y = a.y * (1 - mu) + b.y * mu
      const dydx =
        ((1.5707963267948966 * Math.sin(3.141592653589793 * u)) / dx) *
        (b.y - a.y)
      return { y, angle: Math.atan2(dydx, 1), gap: false }
    }

    const y = a.y + (b.y - a.y) * u
    const dydx = (b.y - a.y) / dx
    return { y, angle: Math.atan2(dydx, 1), gap: false }
  }

  function spawnSpark(wx, wy, vx, vy) {
    if (state.p0life <= state.p1life) {
      state.p0wx = wx
      state.p0wy = wy
      state.p0vx = vx
      state.p0vy = vy
      state.p0life = 0.26
    } else {
      state.p1wx = wx
      state.p1wy = wy
      state.p1vx = vx
      state.p1vy = vy
      state.p1life = 0.26
    }
  }

  function updateProjections() {
    const b = state.bike
    const worldLeft = b.x - BIKE_SCREEN_X

    const targetCamY = clamp(b.y - 168, -85, 60)
    state.camY += (targetCamY - state.camY) * 0.25
    const camY = state.camY

    for (let i = 0; i < SLICE_COUNT; i++) {
      const sampleX = worldLeft + i * SLICE_STEP + 3
      const t = sampleTerrain(sampleX)
      if (t.gap) {
        sliceY[i] = 310
      } else {
        sliceY[i] = clamp((t.y - camY) | 0, 10, 282)
      }
    }

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const sx = BIKE_SCREEN_X
    const sy = b.y - camY

    b.rx = (sx - cosA * 11 - 6) | 0
    b.ry = (sy - sinA * 11 - 6) | 0
    b.r2x = (sx - cosA * 5 - 4) | 0
    b.r2y = (sy - sinA * 5 - 4) | 0
    b.cx = (sx - 5) | 0
    b.cy = (sy - 5) | 0
    b.f2x = (sx + cosA * 5 - 4) | 0
    b.f2y = (sy + sinA * 5 - 4) | 0
    b.fx = (sx + cosA * 11 - 6) | 0
    b.fy = (sy + sinA * 11 - 6) | 0
    b.vxVisor = (sx + sinA * 8 - 4) | 0
    b.vyVisor = (sy - cosA * 8 - 4) | 0

    let gx = -30
    let gy = -30
    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const scX = (g.x - worldLeft - 5) | 0
        const scY = (g.y - camY - 5) | 0
        if (scX >= -10 && scX <= VIEW_W + 10) {
          gx = scX
          gy = clamp(scY, 6, VIEW_H - 12)
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
      const scX = (h.x - worldLeft - 5) | 0
      const scY = (h.y - camY - 12) | 0
      if (scX >= -10 && scX <= VIEW_W + 10) {
        hx = scX
        hy = clamp(scY, 6, VIEW_H - 16)
        break
      }
    }
    state.hazX = hx
    state.hazY = hy

    if (state.p0life > 0) {
      state.p0x = (state.p0wx - worldLeft - 3) | 0
      state.p0y = (state.p0wy - camY - 3) | 0
    } else {
      state.p0x = -30
      state.p0y = -30
    }

    if (state.p1life > 0) {
      state.p1x = (state.p1wx - worldLeft - 3) | 0
      state.p1y = (state.p1wy - camY - 3) | 0
    } else {
      state.p1x = -30
      state.p1y = -30
    }
  }

  function resetWorld() {
    state.nodes = []
    state.worldGems = []
    state.hazards = []
    searchHint = 0
    addNode(0, 190, true, false)
    addNode(80, 190, true, false)
    addNode(155, 220, true, false)
    addNode(230, 162, true, false)
    for (let i = 0; i < 5; i++) {
      appendProceduralChunk()
    }

    state.p0life = 0
    state.p1life = 0

    const startSample = sampleTerrain(48)
    state.bike.x = 48
    state.bike.y = startSample.y - 6
    state.bike.vx = 0
    state.bike.vy = 0
    state.bike.speed = 0
    state.bike.angle = startSample.angle
    state.bike.angVel = 0
    state.bike.onGround = true
    state.bike.airRotation = 0
    state.bike.airFlips = 0
    state.camY = 0
    updateProjections()
  }

  function triggerCrash(reason) {
    state.status = 'gameover'
    state.bannerText = reason
    state.bannerTimer = 2.0
    if (state.score > state.bestScore) {
      state.bestScore = state.score
    }
    spawnSpark(state.bike.x, state.bike.y, -60, -90)
    spawnSpark(state.bike.x, state.bike.y, 70, -80)
    updateProjections()
  }

  function startGame() {
    resetWorld()
    state.status = 'playing'
    state.score = 0
    state.combo = 1
    state.bannerText = 'FULL THROTTLE!'
    state.bannerTimer = 0.9
    updateProjections()
  }

  function cycleTheme() {
    state.themeIdx = (state.themeIdx + 1) % THEMES.length
    return THEMES[state.themeIdx]
  }

  function step(dtInput, isPressing) {
    const dt = clamp(dtInput, 0.008, 0.045)
    let event = null

    if (state.bannerTimer > 0) {
      state.bannerTimer = Math.max(0, state.bannerTimer - dt)
      if (state.bannerTimer === 0 && state.status === 'playing') {
        state.bannerText = 'RIDER 60FPS'
      }
    }

    if (state.p0life > 0) {
      state.p0wx += state.p0vx * dt
      state.p0wy += state.p0vy * dt
      state.p0life -= dt
    }
    if (state.p1life > 0) {
      state.p1wx += state.p1vx * dt
      state.p1wy += state.p1vy * dt
      state.p1life -= dt
    }

    if (state.status !== 'playing') {
      updateProjections()
      return { event }
    }

    const b = state.bike
    const gravity = 380

    if (b.onGround) {
      const cur = sampleTerrain(b.x)
      const slopeGravity = gravity * Math.sin(cur.angle)
      const throttleAcc = isPressing ? 310 : 0
      b.speed += (slopeGravity + throttleAcc) * dt
      b.speed *= isPressing ? 0.994 : 0.982
      b.speed = clamp(b.speed, -50, 320)

      if (isPressing && b.speed < 95) {
        b.speed += 180 * dt
      }

      const prevAngle = cur.angle
      b.x += b.speed * Math.cos(cur.angle) * dt
      const next = sampleTerrain(b.x)

      const angleDrop = next.angle - prevAngle
      if (next.gap || (angleDrop > 0.14 && b.speed > 135)) {
        b.onGround = false
        b.vx = b.speed * Math.cos(prevAngle)
        b.vy = b.speed * Math.sin(prevAngle) - (next.gap ? 38 : 54)
        b.angVel = 0
        b.airRotation = 0
        b.airFlips = 0
      } else {
        b.y = next.y - 6
        b.angle = next.angle
        b.vx = b.speed * Math.cos(next.angle)
        b.vy = b.speed * Math.sin(next.angle)
        if (isPressing && state.p0life <= 0) {
          spawnSpark(
            b.x - Math.cos(b.angle) * 12,
            b.y - Math.sin(b.angle) * 12,
            -b.vx * 0.3,
            -25
          )
        }
      }
    } else {
      b.x += b.vx * dt
      b.vy += gravity * dt
      b.y += b.vy * dt

      if (isPressing) {
        b.angVel = Math.max(-11.4, b.angVel - 32.0 * dt)
        if (state.p1life <= 0) {
          spawnSpark(
            b.x - Math.cos(b.angle) * 11,
            b.y - Math.sin(b.angle) * 11,
            -b.vx * 0.2,
            30
          )
        }
      } else {
        b.angVel *= 0.62
      }

      const dTheta = b.angVel * dt
      b.angle = normalizeAngle(b.angle + dTheta)
      if (dTheta < 0) {
        b.airRotation += -dTheta
        const totalFlips = Math.floor((b.airRotation + 0.38) / 6.283185307179586)
        if (totalFlips > b.airFlips) {
          b.airFlips = totalFlips
          state.score += 2 * state.combo
          state.bannerText = 'FLIP x' + b.airFlips + '!'
          state.bannerTimer = 0.85
          event = 'flip'
        }
      }

      const ground = sampleTerrain(b.x)
      if (!ground.gap && b.y >= ground.y - 6) {
        const diff = Math.abs(normalizeAngle(b.angle - ground.angle))
        if (diff > 1.34) {
          triggerCrash('CRASHED!')
          return { event: 'crash' }
        }

        b.y = ground.y - 6
        b.onGround = true
        b.angle = ground.angle
        const projected =
          b.vx * Math.cos(ground.angle) + b.vy * Math.sin(ground.angle)
        b.speed = clamp(Math.max(95, projected), 95, 320)
        b.angVel = 0

        if (b.airFlips > 0) {
          if (diff < 0.35) {
            state.combo = Math.min(5, state.combo + 1)
            const bonus = b.airFlips * 3 * state.combo
            state.score += bonus
            state.bannerText = 'PERFECT +' + bonus
            state.bannerTimer = 1.0
          } else {
            state.combo = 1
            const bonus = b.airFlips * 2
            state.score += bonus
            state.bannerText = 'CLEAN +' + bonus
            state.bannerTimer = 0.85
          }
          event = 'land'
        }
        b.airRotation = 0
        b.airFlips = 0
      } else if (b.y > 330) {
        triggerCrash('VOID FALL!')
        return { event: 'crash' }
      }
    }

    for (let i = 0; i < state.hazards.length; i++) {
      const h = state.hazards[i]
      const dx = h.x - b.x
      const dy = h.y - b.y
      if (dx * dx + dy * dy < 196) {
        triggerCrash('LASER HIT!')
        return { event: 'crash' }
      }
    }

    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const dx = g.x - b.x
        const dy = g.y - b.y
        if (dx * dx + dy * dy < 360) {
          g.taken = true
          state.gems += 1
          state.score += 3
          state.bannerText = 'GEM +3'
          state.bannerTimer = 0.7
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

    while (state.nodes[state.nodes.length - 1].x < b.x + 340) {
      appendProceduralChunk()
    }
    while (state.nodes.length > 10 && state.nodes[1].x < b.x - 140) {
      state.nodes.shift()
      if (searchHint > 0) searchHint -= 1
    }
    while (state.worldGems.length > 0 && state.worldGems[0].x < b.x - 90) {
      state.worldGems.shift()
    }
    while (state.hazards.length > 0 && state.hazards[0].x < b.x - 90) {
      state.hazards.shift()
    }

    updateProjections()
    return { event }
  }

  function getRenderSnapshot() {
    return {
      status: state.status,
      theme: THEMES[state.themeIdx],
      score: state.score,
      bestScore: state.bestScore,
      gems: state.gems,
      bannerText: state.bannerText,
      bike: state.bike,
      sliceY: state.sliceY,
      gemX: state.gemX,
      gemY: state.gemY,
      hazX: state.hazX,
      hazY: state.hazY,
      p0x: state.p0x,
      p0y: state.p0y,
      p1x: state.p1x,
      p1y: state.p1y
    }
  }

  resetWorld()

  return {
    state,
    startGame,
    cycleTheme,
    step,
    getRenderSnapshot
  }
  }
