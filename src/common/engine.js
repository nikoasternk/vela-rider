export const VIEW_W = 210
export const VIEW_H = 240
export const CHART_POINTS = 16
export const POINT_STEP = 14
export const BIKE_SCREEN_X = 42

export const THEMES = [
  {
    name: 'CYBER',
    track: '#00F0FF',
    fill: '#052636',
    bike: '#FF0055',
    wheel: '#00F0FF',
    visor: '#FFD700'
  },
  {
    name: 'SYNTH',
    track: '#FF007F',
    fill: '#2A041C',
    bike: '#00F0FF',
    wheel: '#FF007F',
    visor: '#FFFFFF'
  },
  {
    name: 'VENOM',
    track: '#00FF66',
    fill: '#042814',
    bike: '#BC13FE',
    wheel: '#00FF66',
    visor: '#FFFF00'
  },
  {
    name: 'SOLAR',
    track: '#FFB800',
    fill: '#2B1D02',
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

  const chartData = new Array(CHART_POINTS)
  for (let i = 0; i < CHART_POINTS; i++) {
    chartData[i] = 70
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
    bike: {
      x: 42,
      y: 164,
      vx: 0,
      vy: 0,
      speed: 0,
      angle: 0,
      angVel: 0,
      onGround: true,
      airRotation: 0,
      airFlips: 0,
      rx: 32,
      ry: 164,
      cx: 42,
      cy: 164,
      fx: 52,
      fy: 164,
      vxVisor: 42,
      vyVisor: 155
    },
    gemX: -30,
    gemY: -30,
    chartData
  }

  function addNode(x, y, smooth, gap) {
    state.nodes.push({
      x,
      y: clamp(y, 68, 212),
      smooth: Boolean(smooth),
      gap: Boolean(gap)
    })
  }

  function appendProceduralChunk() {
    const last = state.nodes[state.nodes.length - 1]
    const x0 = last.x
    const y0 = last.y
    const r = nextRand()

    if (r < 0.36) {
      const amp = 34 + nextRand() * 30
      const w1 = 84 + nextRand() * 28
      const w2 = 84 + nextRand() * 28
      const yValley = clamp(y0 + amp, 125, 208)
      const yCrest = clamp(yValley - amp * 1.35, 76, 168)
      addNode(x0 + w1, yValley, true, false)
      addNode(x0 + w1 + w2, yCrest, true, false)
      addNode(x0 + w1 + w2 + 78, clamp(yCrest + 28, 118, 196), true, false)
      state.worldGems.push({
        x: x0 + w1 + w2 + 16,
        y: yCrest - 32,
        taken: false
      })
    } else if (r < 0.70) {
      const dipY = clamp(y0 + 34, 136, 206)
      const lipY = clamp(dipY - 52, 84, 164)
      const gapW = 46 + nextRand() * 20
      const catchY = clamp(lipY + 26, 122, 198)
      addNode(x0 + 68, dipY, true, false)
      addNode(x0 + 132, lipY, true, true)
      addNode(x0 + 132 + gapW, catchY, true, false)
      addNode(x0 + 204 + gapW, clamp(catchY + 18, 132, 202), true, false)
      state.worldGems.push({
        x: x0 + 132 + gapW * 0.5,
        y: lipY - 40,
        taken: false
      })
    } else {
      const plungeY = clamp(y0 + 54, 154, 210)
      const peakY = clamp(plungeY - 72, 76, 152)
      addNode(x0 + 84, plungeY, true, false)
      addNode(x0 + 168, peakY, true, false)
      addNode(x0 + 248, clamp(peakY + 42, 128, 198), true, false)
      state.worldGems.push({
        x: x0 + 182,
        y: peakY - 42,
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

  function updateProjections() {
    const b = state.bike
    const worldLeft = b.x - BIKE_SCREEN_X

    const targetCamY = clamp(b.y - 148, -70, 50)
    state.camY += (targetCamY - state.camY) * 0.25
    const camY = state.camY

    for (let i = 0; i < CHART_POINTS; i++) {
      const sampleX = worldLeft + i * POINT_STEP
      const t = sampleTerrain(sampleX)
      if (t.gap) {
        chartData[i] = 2
      } else {
        const syScreen = clamp((t.y - camY) | 0, 12, VIEW_H - 6)
        chartData[i] = clamp(VIEW_H - syScreen, 4, VIEW_H - 8)
      }
    }

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const sx = BIKE_SCREEN_X
    const sy = b.y - camY

    b.rx = (sx - cosA * 10 - 6) | 0
    b.ry = (sy - sinA * 10 - 6) | 0
    b.cx = (sx - 6) | 0
    b.cy = (sy - 5) | 0
    b.fx = (sx + cosA * 10 - 6) | 0
    b.fy = (sy + sinA * 10 - 6) | 0
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
  }

  function resetWorld() {
    state.nodes = []
    state.worldGems = []
    searchHint = 0
    addNode(0, 170, true, false)
    addNode(84, 170, true, false)
    addNode(168, 198, true, false)
    addNode(252, 144, true, false)
    for (let i = 0; i < 5; i++) {
      appendProceduralChunk()
    }

    const startSample = sampleTerrain(42)
    state.bike.x = 42
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
    updateProjections()
  }

  function startGame() {
    resetWorld()
    state.status = 'playing'
    state.score = 0
    state.combo = 1
    state.bannerText = 'GO!'
    state.bannerTimer = 0.8
    updateProjections()
  }

  function cycleTheme() {
    state.themeIdx = (state.themeIdx + 1) % THEMES.length
    return THEMES[state.themeIdx]
  }

  function step(dtInput, isPressing) {
    const dt = clamp(dtInput, 0.015, 0.055)
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
    const gravity = 380

    if (b.onGround) {
      const cur = sampleTerrain(b.x)
      const slopeGravity = gravity * Math.sin(cur.angle)
      const throttleAcc = isPressing ? 320 : 0
      b.speed += (slopeGravity + throttleAcc) * dt
      b.speed *= isPressing ? 0.994 : 0.982
      b.speed = clamp(b.speed, -50, 320)

      if (isPressing && b.speed < 105) {
        b.speed += 190 * dt
      }

      const prevAngle = cur.angle
      b.x += b.speed * Math.cos(cur.angle) * dt
      const next = sampleTerrain(b.x)

      const angleDrop = next.angle - prevAngle
      if (next.gap || (angleDrop > 0.14 && b.speed > 135)) {
        b.onGround = false
        b.vx = b.speed * Math.cos(prevAngle)
        b.vy = b.speed * Math.sin(prevAngle) - (next.gap ? 40 : 56)
        b.angVel = 0
        b.airRotation = 0
        b.airFlips = 0
      } else {
        b.y = next.y - 6
        b.angle = next.angle
        b.vx = b.speed * Math.cos(next.angle)
        b.vy = b.speed * Math.sin(next.angle)
      }
    } else {
      b.x += b.vx * dt
      b.vy += gravity * dt
      b.y += b.vy * dt

      if (isPressing) {
        b.angVel = Math.max(-11.5, b.angVel - 34.0 * dt)
      } else {
        b.angVel *= 0.6
      }

      const dTheta = b.angVel * dt
      b.angle = normalizeAngle(b.angle + dTheta)
      if (dTheta < 0) {
        b.airRotation += -dTheta
        const totalFlips = Math.floor((b.airRotation + 0.38) / 6.283185307179586)
        if (totalFlips > b.airFlips) {
          b.airFlips = totalFlips
          state.score += 2 * state.combo
          state.bannerText = 'FLIP x' + b.airFlips
          state.bannerTimer = 0.8
          event = 'flip'
        }
      }

      const ground = sampleTerrain(b.x)
      if (!ground.gap && b.y >= ground.y - 6) {
        const diff = Math.abs(normalizeAngle(b.angle - ground.angle))
        if (diff > 1.35) {
          triggerCrash('CRASHED!')
          return { event: 'crash' }
        }

        b.y = ground.y - 6
        b.onGround = true
        b.angle = ground.angle
        const projected =
          b.vx * Math.cos(ground.angle) + b.vy * Math.sin(ground.angle)
        b.speed = clamp(Math.max(100, projected), 100, 320)
        b.angVel = 0

        if (b.airFlips > 0) {
          if (diff < 0.36) {
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
          event = 'land'
        }
        b.airRotation = 0
        b.airFlips = 0
      } else if (b.y > 290) {
        triggerCrash('VOID FALL!')
        return { event: 'crash' }
      }
    }

    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const dx = g.x - b.x
        const dy = g.y - b.y
        if (dx * dx + dy * dy < 380) {
          g.taken = true
          state.gems += 1
          state.score += 3
          state.bannerText = 'GEM +3'
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
      chartData: state.chartData,
      gemX: state.gemX,
      gemY: state.gemY
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
