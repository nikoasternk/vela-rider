export const VIEW_W = 210
export const VIEW_H = 300
export const COL_COUNT = 21
export const COL_WIDTH = 10
export const BIKE_SCREEN_X = 48

export const THEMES = [
  {
    name: 'CYBER',
    track: '#00F0FF',
    sub: '#04222C',
    bike: '#FF0055',
    wheel: '#00F0FF',
    visor: '#FFFFFF',
    gem: '#FFD700',
    hazard: '#FF1744'
  },
  {
    name: 'SYNTH',
    track: '#FF007F',
    sub: '#2A041C',
    bike: '#00F0FF',
    wheel: '#FF007F',
    visor: '#FFFF00',
    gem: '#00FFCC',
    hazard: '#FF3D00'
  },
  {
    name: 'VENOM',
    track: '#00FF66',
    sub: '#042814',
    bike: '#BC13FE',
    wheel: '#00FF66',
    visor: '#FFFFFF',
    gem: '#00F0FF',
    hazard: '#FF1744'
  },
  {
    name: 'SOLAR',
    track: '#FFB800',
    sub: '#2B1D02',
    bike: '#00E5FF',
    wheel: '#FFB800',
    visor: '#FFFFFF',
    gem: '#FF0055',
    hazard: '#FF1744'
  }
]

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v
}

function normalizeAngle(a) {
  let r = a % (Math.PI * 2)
  if (r > Math.PI) r -= Math.PI * 2
  if (r < -Math.PI) r += Math.PI * 2
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

  const columns = []
  for (let i = 0; i < COL_COUNT; i++) {
    columns.push({
      id: i,
      skyH: 200,
      surfH: 6,
      subH: 94,
      hazH: 0,
      surfColor: THEMES[0].track,
      subColor: THEMES[0].sub
    })
  }

  const particles = []
  for (let i = 0; i < 6; i++) {
    particles.push({
      id: i,
      wx: 0,
      wy: 0,
      vx: 0,
      vy: 0,
      life: 0,
      x: -20,
      y: -20,
      color: '#00F0FF'
    })
  }

  const gemViews = [
    { id: 0, x: -30, y: -30 },
    { id: 1, x: -30, y: -30 }
  ]

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
    lastChunkIdx: 0,
    bike: {
      x: 40,
      y: 190,
      vx: 0,
      vy: 0,
      speed: 0,
      angle: 0,
      angVel: 0,
      onGround: true,
      airRotation: 0,
      airFlips: 0,
      rx: 38,
      ry: 190,
      fx: 58,
      fy: 190,
      cx: 48,
      cy: 188,
      hx: 48,
      hy: 180
    },
    columns,
    particles,
    gemViews
  }

  function addNode(x, y, smooth, gap, hazard) {
    state.nodes.push({
      x,
      y: clamp(y, 85, 265),
      smooth: Boolean(smooth),
      gap: Boolean(gap),
      hazard: Boolean(hazard)
    })
  }

  function spawnGemArc(xStart, yStart, xEnd, yPeak, count) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1)
      const gx = xStart + (xEnd - xStart) * t
      const parabola = 4 * t * (1 - t)
      const gy = yStart - parabola * (yStart - yPeak)
      state.worldGems.push({
        x: gx,
        y: gy,
        taken: false
      })
    }
  }

  function appendProceduralChunk() {
    const last = state.nodes[state.nodes.length - 1]
    const x0 = last.x
    const y0 = last.y
    state.lastChunkIdx += 1
    const r = nextRand()

    if (r < 0.28) {
      const amp = 34 + nextRand() * 34
      const w1 = 68 + nextRand() * 26
      const w2 = 72 + nextRand() * 28
      const yValley = clamp(y0 + amp, 130, 255)
      const yCrest = clamp(yValley - amp * 1.45, 95, 210)
      addNode(x0 + w1, yValley, true, false, false)
      addNode(x0 + w1 + w2, yCrest, true, false, false)
      addNode(x0 + w1 + w2 + 65, clamp(yCrest + 28, 125, 240), true, false, false)
      spawnGemArc(x0 + w1 + w2 - 10, yCrest - 18, x0 + w1 + w2 + 50, yCrest - 52, 2)
    } else if (r < 0.56) {
      const dipY = clamp(y0 + 36, 150, 255)
      const lipY = clamp(dipY - 58, 100, 195)
      const gapW = 46 + nextRand() * 24
      const catchY = clamp(lipY + 26, 130, 235)
      addNode(x0 + 55, dipY, true, false, false)
      addNode(x0 + 110, lipY, false, true, false)
      addNode(x0 + 110 + gapW, catchY, false, false, false)
      addNode(x0 + 175 + gapW, clamp(catchY + 22, 145, 245), true, false, false)
      spawnGemArc(x0 + 112, lipY - 22, x0 + 108 + gapW, lipY - 64, 2)
    } else if (r < 0.80) {
      const plungeY = clamp(y0 + 64, 175, 260)
      const peakY = clamp(plungeY - 82, 92, 175)
      addNode(x0 + 75, plungeY, true, false, false)
      addNode(x0 + 150, peakY, true, false, false)
      addNode(x0 + 225, clamp(peakY + 48, 140, 235), true, false, false)
      spawnGemArc(x0 + 145, peakY - 20, x0 + 205, peakY - 68, 2)
    } else {
      const flatY = clamp(y0, 135, 225)
      const kickerY = clamp(flatY - 26, 110, 200)
      addNode(x0 + 48, flatY, true, false, false)
      addNode(x0 + 78, kickerY, false, false, false)
      addNode(x0 + 105, flatY, false, false, true)
      addNode(x0 + 128, flatY, true, false, false)
      addNode(x0 + 185, clamp(flatY + 18, 140, 240), true, false, false)
      spawnGemArc(x0 + 82, kickerY - 26, x0 + 132, kickerY - 54, 1)
    }
  }

  function sampleTerrain(wx) {
    const nodes = state.nodes
    let segIdx = 0
    for (let i = 0; i < nodes.length - 1; i++) {
      if (wx >= nodes[i].x && wx <= nodes[i + 1].x) {
        segIdx = i
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
      return { y: 9999, angle: 0, gap: true, hazard: false }
    }

    let y = 0
    let dydx = 0
    if (a.smooth) {
      const mu = (1 - Math.cos(Math.PI * u)) * 0.5
      y = a.y * (1 - mu) + b.y * mu
      dydx = ((Math.PI * Math.sin(Math.PI * u)) / (2 * dx)) * (b.y - a.y)
    } else {
      y = a.y + (b.y - a.y) * u
      dydx = (b.y - a.y) / dx
    }

    const hazard = a.hazard && u > 0.25 && u < 0.75
    return {
      y,
      angle: Math.atan2(dydx, 1),
      gap: false,
      hazard
    }
  }

  function emitParticles(wx, wy, baseVx, baseVy, count, color, spread) {
    let spawned = 0
    for (let i = 0; i < state.particles.length && spawned < count; i++) {
      const p = state.particles[i]
      if (p.life <= 0) {
        const ang = nextRand() * Math.PI * 2
        const spd = (0.3 + nextRand() * 0.7) * spread
        p.wx = wx
        p.wy = wy
        p.vx = baseVx + Math.cos(ang) * spd
        p.vy = baseVy + Math.sin(ang) * spd
        p.life = 0.28 + nextRand() * 0.28
        p.color = color
        spawned += 1
      }
    }
  }

  function updateProjections() {
    const theme = THEMES[state.themeIdx]
    const b = state.bike
    const worldLeft = b.x - BIKE_SCREEN_X

    const targetCamY = clamp(b.y - 175, -95, 65)
    state.camY += (targetCamY - state.camY) * 0.22

    for (let i = 0; i < COL_COUNT; i++) {
      const sampleX = worldLeft + i * COL_WIDTH + COL_WIDTH * 0.5
      const t = sampleTerrain(sampleX)
      const col = state.columns[i]

      if (t.gap) {
        col.skyH = VIEW_H
        col.surfH = 0
        col.subH = 0
        col.hazH = 0
      } else {
        const screenY = Math.round(t.y - state.camY)
        const clampedY = clamp(screenY, 16, VIEW_H - 8)
        const hazH = t.hazard ? 14 : 0
        const skyH = clamp(clampedY - hazH, 0, VIEW_H)
        const surfH = 6
        const subH = Math.max(0, VIEW_H - skyH - hazH - surfH)
        col.skyH = skyH
        col.hazH = hazH
        col.surfH = surfH
        col.subH = subH
        col.surfColor = theme.track
        col.subColor = theme.sub
      }
    }

    const cosA = Math.cos(b.angle)
    const sinA = Math.sin(b.angle)
    const screenBikeX = BIKE_SCREEN_X
    const screenBikeY = b.y - state.camY
    const wheelBase = 10

    b.rx = Math.round(screenBikeX - cosA * wheelBase - 6)
    b.ry = Math.round(screenBikeY - sinA * wheelBase - 6)
    b.fx = Math.round(screenBikeX + cosA * wheelBase - 6)
    b.fy = Math.round(screenBikeY + sinA * wheelBase - 6)
    b.cx = Math.round(screenBikeX - 5)
    b.cy = Math.round(screenBikeY - 5)
    b.hx = Math.round(screenBikeX + sinA * 8 - 4)
    b.hy = Math.round(screenBikeY - cosA * 8 - 4)

    let gemSlot = 0
    for (let i = 0; i < state.worldGems.length && gemSlot < 2; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const sx = Math.round(g.x - worldLeft - 5)
        const sy = Math.round(g.y - state.camY - 5)
        if (sx >= -8 && sx <= VIEW_W + 8 && sy >= 0 && sy <= VIEW_H - 10) {
          state.gemViews[gemSlot].x = sx
          state.gemViews[gemSlot].y = sy
          gemSlot += 1
        }
      }
    }
    while (gemSlot < 2) {
      state.gemViews[gemSlot].x = -30
      state.gemViews[gemSlot].y = -30
      gemSlot += 1
    }

    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i]
      if (p.life > 0) {
        p.x = Math.round(p.wx - worldLeft - 3)
        p.y = Math.round(p.wy - state.camY - 3)
      } else {
        p.x = -30
        p.y = -30
      }
    }
  }

  function resetWorld() {
    state.nodes = []
    state.worldGems = []
    state.lastChunkIdx = 0
    addNode(0, 195, true, false, false)
    addNode(75, 195, true, false, false)
    addNode(145, 222, true, false, false)
    addNode(215, 168, true, false, false)
    for (let i = 0; i < 5; i++) {
      appendProceduralChunk()
    }

    for (let i = 0; i < state.particles.length; i++) {
      state.particles[i].life = 0
      state.particles[i].x = -30
      state.particles[i].y = -30
    }

    const startSample = sampleTerrain(40)
    state.bike.x = 40
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
    for (let i = 0; i < state.particles.length; i++) {
      state.particles[i].life = 0
    }
    emitParticles(
      state.bike.x,
      state.bike.y,
      state.bike.vx * 0.2,
      -60,
      6,
      THEMES[state.themeIdx].bike,
      130
    )
    updateProjections()
  }

  function startGame() {
    resetWorld()
    state.status = 'playing'
    state.score = 0
    state.combo = 1
    state.bannerText = 'GO!'
    state.bannerTimer = 1.0
    updateProjections()
  }

  function cycleTheme() {
    state.themeIdx = (state.themeIdx + 1) % THEMES.length
    updateProjections()
    return THEMES[state.themeIdx]
  }

  function step(dtInput, isPressing) {
    const dt = clamp(dtInput, 0.01, 0.05)
    let event = null

    if (state.bannerTimer > 0) {
      state.bannerTimer = Math.max(0, state.bannerTimer - dt)
      if (state.bannerTimer === 0 && state.status === 'playing') {
        state.bannerText = isPressing ? 'BOOSTING' : 'COASTING'
      }
    }

    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i]
      if (p.life > 0) {
        p.wx += p.vx * dt
        p.wy += p.vy * dt
        p.vy += 260 * dt
        p.life -= dt
      }
    }

    if (state.status !== 'playing') {
      updateProjections()
      return { event }
    }

    const b = state.bike
    const gravity = 350
    const theme = THEMES[state.themeIdx]

    if (b.onGround) {
      const cur = sampleTerrain(b.x)
      const slopeGravity = gravity * Math.sin(cur.angle)
      const throttleAcc = isPressing ? 275 : 0
      b.speed += (slopeGravity + throttleAcc) * dt
      b.speed *= isPressing ? 0.992 : 0.975
      b.speed = clamp(b.speed, -60, 290)

      if (isPressing && b.speed < 75) {
        b.speed += 140 * dt
      }

      const prevAngle = cur.angle
      b.x += b.speed * Math.cos(cur.angle) * dt
      const next = sampleTerrain(b.x)

      if (next.hazard) {
        triggerCrash('LASER HIT!')
        return { event: 'crash' }
      }

      const angleDrop = next.angle - prevAngle
      if (next.gap || (angleDrop > 0.16 && b.speed > 135)) {
        b.onGround = false
        b.vx = b.speed * Math.cos(prevAngle)
        b.vy = b.speed * Math.sin(prevAngle) - (next.gap ? 32 : 48)
        b.angVel = 0
        b.airRotation = 0
        b.airFlips = 0
      } else {
        b.y = next.y - 6
        b.angle = next.angle
        b.vx = b.speed * Math.cos(next.angle)
        b.vy = b.speed * Math.sin(next.angle)
        if (isPressing && nextRand() < 0.55) {
          emitParticles(
            b.x - Math.cos(b.angle) * 10,
            b.y - Math.sin(b.angle) * 10,
            -b.vx * 0.25,
            -20,
            1,
            theme.track,
            35
          )
        }
      }
    } else {
      b.x += b.vx * dt
      b.vy += gravity * dt
      b.y += b.vy * dt

      if (isPressing) {
        b.angVel = Math.max(-10.2, b.angVel - 28.0 * dt)
        if (nextRand() < 0.65) {
          emitParticles(
            b.x - Math.cos(b.angle) * 10,
            b.y - Math.sin(b.angle) * 10,
            -b.vx * 0.15,
            25,
            1,
            theme.bike,
            45
          )
        }
      } else {
        b.angVel *= 0.68
      }

      const dTheta = b.angVel * dt
      b.angle = normalizeAngle(b.angle + dTheta)
      if (dTheta < 0) {
        b.airRotation += -dTheta
        const totalFlips = Math.floor((b.airRotation + 0.35) / (Math.PI * 2))
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
        if (ground.hazard) {
          triggerCrash('LASER HIT!')
          return { event: 'crash' }
        }

        const diff = Math.abs(normalizeAngle(b.angle - ground.angle))
        if (diff > 1.32) {
          triggerCrash('CRASHED!')
          return { event: 'crash' }
        }

        b.y = ground.y - 6
        b.onGround = true
        b.angle = ground.angle
        const projected =
          b.vx * Math.cos(ground.angle) + b.vy * Math.sin(ground.angle)
        b.speed = clamp(Math.max(85, projected), 85, 295)
        b.angVel = 0

        if (b.airFlips > 0) {
          if (diff < 0.34) {
            state.combo = Math.min(5, state.combo + 1)
            const bonus = b.airFlips * 3 * state.combo
            state.score += bonus
            state.bannerText = 'PERFECT +' + bonus
            state.bannerTimer = 1.1
          } else {
            state.combo = 1
            const bonus = b.airFlips * 2
            state.score += bonus
            state.bannerText = 'CLEAN +' + bonus
            state.bannerTimer = 0.9
          }
          event = 'land'
        }
        b.airRotation = 0
        b.airFlips = 0
      } else if (b.y > 335) {
        triggerCrash('VOID FALL!')
        return { event: 'crash' }
      }
    }

    for (let i = 0; i < state.worldGems.length; i++) {
      const g = state.worldGems[i]
      if (!g.taken) {
        const dx = g.x - b.x
        const dy = g.y - b.y
        if (dx * dx + dy * dy < 324) {
          g.taken = true
          state.gems += 1
          state.score += 3
          state.bannerText = 'GEM +3'
          state.bannerTimer = 0.7
          emitParticles(g.x, g.y, 0, -30, 2, theme.gem, 55)
          if (!event) event = 'gem'
        }
      }
    }

    const distanceScore = Math.floor(b.x / 95)
    if (distanceScore > state.score) {
      state.score = distanceScore
    }
    if (state.score > state.bestScore) {
      state.bestScore = state.score
    }

    while (state.nodes[state.nodes.length - 1].x < b.x + 360) {
      appendProceduralChunk()
    }
    while (state.nodes.length > 10 && state.nodes[1].x < b.x - 140) {
      state.nodes.shift()
    }
    while (state.worldGems.length > 0 && state.worldGems[0].x < b.x - 100) {
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
      combo: state.combo,
      bannerText: state.bannerText,
      bike: state.bike,
      columns: state.columns,
      particles: state.particles,
      gemsView: state.gemViews
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
