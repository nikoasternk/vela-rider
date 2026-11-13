import fs from 'fs'
import path from 'path'

function check(condition, testName, debugPayload) {
  if (!condition) {
    console.error('========================================')
    console.error('[DIAGNOSTIC FAIL]:', testName)
    console.error('[DEBUG PAYLOAD]:', JSON.stringify(debugPayload, null, 2))
    console.error('========================================')
    process.exit(1)
  }
}

const manifestRaw = fs.readFileSync(path.resolve('src/manifest.json'), 'utf8')
const manifest = JSON.parse(manifestRaw)
check(manifest.package === 'com.band.rider', 'MANIFEST_PACKAGE_NAME', {
  actualPackage: manifest.package
})

const workflowRaw = fs.readFileSync(path.resolve('.github/workflows/build.yml'), 'utf8')
check(
  workflowRaw.includes('workflow_dispatch') && !workflowRaw.includes('branches:'),
  'WORKFLOW_MANUAL_ONLY',
  { workflowRaw }
)

const source = fs.readFileSync(new URL('../src/common/engine.js', import.meta.url), 'utf8')
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64')
const {
  createGameEngine,
  computeRainbowTrackColor,
  RAINBOW_COLORS,
  SECTION_LENGTH,
  CHART_POINTS,
  VIEW_H
} = await import(moduleUrl)

console.log('[TEST 1/8] Checking rainbow color interpolation...')
check(RAINBOW_COLORS.length === 7, 'RAINBOW_COLORS_LEN', { len: RAINBOW_COLORS.length })
for (let i = 0; i < 7; i++) {
  const cStart = computeRainbowTrackColor(i * SECTION_LENGTH + 50)
  const cMid = computeRainbowTrackColor(i * SECTION_LENGTH + 600)
  check(cStart === RAINBOW_COLORS[i] && cMid === RAINBOW_COLORS[i], 'RAINBOW_SECTION_' + i, {
    i,
    cStart,
    cMid,
    expected: RAINBOW_COLORS[i]
  })
}
console.log('[PASS] Rainbow color interpolation OK')

console.log('[TEST 2/8] Checking world generation, C1 abyss continuity & universal viewport...')
const engine = createGameEngine(1337)
engine.startGame()
check(engine.state.status === 'playing', 'ENGINE_START_PLAYING', { status: engine.state.status })
check(engine.state.chartData.length === CHART_POINTS, 'CHART_POINTS_COUNT', {
  len: engine.state.chartData.length
})
check(engine.state.segs.some((s) => s.abyss), 'HAS_ABYSS_SEGMENTS', {
  segsCount: engine.state.segs.length
})
check(engine.state.segs.some((s) => s.island), 'HAS_ISLAND_SEGMENTS', {
  segsCount: engine.state.segs.length
})
check(engine.state.segs.some((s) => s.peakLaunch), 'HAS_MOUNTAIN_WITH_SAW', {
  segsCount: engine.state.segs.length
})
check(engine.state.hazards.length >= 2, 'HAS_SAWS_GENERATED', {
  hazardsCount: engine.state.hazards.length
})

for (let i = 1; i < engine.state.segs.length; i++) {
  const prev = engine.state.segs[i - 1]
  const curr = engine.state.segs[i]
  check(
    Math.abs(prev.y1 - curr.y0) < 0.01 && Math.abs(prev.m1 - curr.m0) < 0.01,
    'C1_SPLINE_CONTINUITY_AT_SEG_' + i,
    { index: i, prevY1: prev.y1, currY0: curr.y0, prevM1: prev.m1, currM0: curr.m0 }
  )
}

engine.setViewport(200, 180)
check(engine.state.viewH === 180, 'VIEWPORT_RESIZE_180', { viewH: engine.state.viewH })
for (let j = 0; j < engine.state.chartData.length; j++) {
  check(
    engine.state.chartData[j] >= 4 && engine.state.chartData[j] <= 176,
    'CHART_BOUNDS_180',
    { index: j, val: engine.state.chartData[j] }
  )
}
engine.setViewport(200, VIEW_H)
console.log('[PASS] World generation & C1 abyss continuity OK')

console.log('[TEST 3/8] Checking bike complete stop when button is released...')
const stopEngine = createGameEngine(2026)
stopEngine.startGame()
for (let i = 0; i < 90; i++) {
  stopEngine.step(0.016, false)
}
check(
  stopEngine.state.bike.speed === 0 && stopEngine.state.status === 'playing',
  'BIKE_STOPS_WHEN_RELEASED',
  {
    speed: stopEngine.state.bike.speed,
    x: stopEngine.state.bike.x,
    status: stopEngine.state.status
  }
)
console.log('[PASS] Bike complete stop when released OK')

console.log('[TEST 4/8] Checking high jump off saw-free mountain at full speed...')
const freeMountEngine = createGameEngine(2026)
freeMountEngine.startGame()
const freeMountSeg = freeMountEngine.state.segs.find((s) => s.kicker && s.dx === 90)
check(Boolean(freeMountSeg), 'FIND_FREE_MOUNTAIN_PEAK', {})
freeMountEngine.state.bike.x = freeMountSeg.x0 + 40
freeMountEngine.state.bike.y = freeMountSeg.y0 - 20
freeMountEngine.state.bike.speed = 210
freeMountEngine.state.bike.onGround = true
let launchedHighOffMountain = false
for (let i = 0; i < 30; i++) {
  freeMountEngine.step(0.016, true)
  if (!freeMountEngine.state.bike.onGround && freeMountEngine.state.bike.vy < -150) {
    launchedHighOffMountain = true
    break
  }
}
check(launchedHighOffMountain, 'FREE_MOUNTAIN_HIGH_JUMP_LAUNCH', {
  onGround: freeMountEngine.state.bike.onGround,
  vy: freeMountEngine.state.bike.vy
})
console.log('[PASS] High jump off saw-free mountain OK')

console.log('[TEST 5/8] Checking high mountain overhanging red saw & hitbox clarity...')
const steepSawHitBot = createGameEngine(2026)
steepSawHitBot.startGame()
const peakSeg = steepSawHitBot.state.segs.find((s) => s.peakLaunch)
check(Boolean(peakSeg), 'FIND_PEAK_LAUNCH_SEG', {})
steepSawHitBot.state.bike.x = peakSeg.x0 - 6
steepSawHitBot.state.bike.y = peakSeg.y0 - 6
steepSawHitBot.state.bike.speed = 180
steepSawHitBot.state.bike.onGround = true
for (let i = 0; i < 45; i++) {
  steepSawHitBot.step(0.016, true)
  if (steepSawHitBot.state.status === 'gameover') break
}
check(
  steepSawHitBot.state.status === 'gameover' && steepSawHitBot.state.crashReason === 'ПИЛА!',
  'MOUNTAIN_SAW_HIT_ON_FULL_GAS',
  {
    status: steepSawHitBot.state.status,
    crashReason: steepSawHitBot.state.crashReason,
    bikeX: steepSawHitBot.state.bike.x,
    bikeY: steepSawHitBot.state.bike.y
  }
)

const steepSawSafeBot = createGameEngine(2026)
steepSawSafeBot.startGame()
const peakSegSafe = steepSawSafeBot.state.segs.find((s) => s.peakLaunch)
const mountainSaw = steepSawSafeBot.state.hazards.find((h) => Math.abs(h.x - (peakSegSafe.x0 + 80)) < 5)
check(Boolean(mountainSaw), 'FIND_MOUNTAIN_SAW', {})
steepSawSafeBot.state.bike.x = peakSegSafe.x0 - 70
steepSawSafeBot.state.bike.y = peakSegSafe.y0 + 30
steepSawSafeBot.state.bike.speed = 175
steepSawSafeBot.state.bike.onGround = true
let minDistToSaw = 9999
for (let i = 0; i < 110; i++) {
  steepSawSafeBot.step(0.016, false)
  const d = Math.hypot(
    mountainSaw.x - steepSawSafeBot.state.bike.x,
    mountainSaw.y - steepSawSafeBot.state.bike.y
  )
  if (d < minDistToSaw) minDistToSaw = d
  check(steepSawSafeBot.state.status === 'playing', 'MOUNTAIN_SAW_SAFE_DESCENT_STEP_' + i, {
    step: i,
    status: steepSawSafeBot.state.status,
    crashReason: steepSawSafeBot.state.crashReason,
    bikeX: steepSawSafeBot.state.bike.x,
    bikeY: steepSawSafeBot.state.bike.y,
    minDistToSaw
  })
}
check(
  steepSawSafeBot.state.bike.x > peakSegSafe.x0 + 130 && minDistToSaw > 26,
  'MOUNTAIN_SAW_SAFE_CLEARANCE_VISUAL_GAP',
  {
    bikeX: steepSawSafeBot.state.bike.x,
    minDistToSaw
  }
)
console.log('[PASS] High mountain overhanging red saw & hitbox clarity OK:', {
  minDistToSaw: Math.round(minDistToSaw)
})

console.log('[TEST 6/8] Checking abyss fall & reckless hold crash...')
const abyssFallBot = createGameEngine(2026)
abyssFallBot.startGame()
const firstAbyss = abyssFallBot.state.segs.find((s) => s.abyss)
check(Boolean(firstAbyss), 'FIND_FIRST_ABYSS', {})
abyssFallBot.state.bike.x = firstAbyss.x0 - 6
abyssFallBot.state.bike.y = firstAbyss.y0 - 6
abyssFallBot.state.bike.speed = 65
abyssFallBot.state.bike.onGround = true
for (let i = 0; i < 60; i++) {
  abyssFallBot.step(0.016, false)
  if (abyssFallBot.state.status === 'gameover') break
}
check(
  abyssFallBot.state.status === 'gameover' && abyssFallBot.state.crashReason === 'В ПРОПАСТЬ!',
  'LOW_SPEED_FALLS_INTO_ABYSS',
  {
    status: abyssFallBot.state.status,
    crashReason: abyssFallBot.state.crashReason
  }
)

const holdBot = createGameEngine(2026)
holdBot.startGame()
for (let i = 0; i < 400; i++) {
  holdBot.step(0.016, true)
  if (holdBot.state.status === 'gameover') break
}
check(holdBot.state.status === 'gameover', 'RECKLESS_HOLD_BOT_CRASHES', {
  status: holdBot.state.status
})
console.log('[PASS] Abyss fall & reckless hold crash OK')

console.log('[TEST 7/8] Running proBot skill verification (3000 steps)...')
const proBot = createGameEngine(2026)
proBot.startGame()
let flipsDone = 0
let landingsDone = 0
let crashesCount = 0
let lastCrashReason = ''
for (let i = 0; i < 3000; i++) {
  if (proBot.state.status !== 'playing') {
    crashesCount += 1
    lastCrashReason = proBot.state.crashReason
    proBot.startGame()
  }
  const b = proBot.state.bike
  const hold = (b.onGround && !b.onSteepDrop) || (!b.onGround && b.airFlips < 1)
  const res = proBot.step(0.016, hold)
  if (res.event === 'flip') flipsDone += 1
  if (res.event === 'land') landingsDone += 1

  const snap = proBot.getRenderSnapshot()
  for (let j = 0; j < snap.chartData.length; j++) {
    check(
      snap.chartData[j] >= 4 && snap.chartData[j] <= VIEW_H - 4,
      'PROBOT_CHART_BOUNDS',
      { step: i, index: j, val: snap.chartData[j] }
    )
  }
}
check(flipsDone >= 15 && landingsDone >= 15, 'PROBOT_FLIPS_AND_LANDINGS', {
  flipsDone,
  landingsDone,
  crashesCount,
  lastCrashReason,
  bestScore: proBot.state.bestScore
})
console.log('[PASS] proBot skill verification OK:', { flipsDone, landingsDone, crashesCount })

console.log('[TEST 8/8] Running 15,000-step endurance & memory stability test...')
for (let i = 0; i < 15000; i++) {
  if (proBot.state.status !== 'playing') {
    proBot.startGame()
  }
  const b = proBot.state.bike
  const hold = (b.onGround && !b.onSteepDrop) || (!b.onGround && b.airFlips < 1)
  proBot.step(0.016, hold)
  check(proBot.state.segs.length <= 36, 'ENDURANCE_SEGS_BOUNDED', {
    step: i,
    segsLen: proBot.state.segs.length
  })
  check(proBot.state.worldGems.length <= 24, 'ENDURANCE_GEMS_BOUNDED', {
    step: i,
    gemsLen: proBot.state.worldGems.length
  })
  check(proBot.state.hazards.length <= 24, 'ENDURANCE_HAZARDS_BOUNDED', {
    step: i,
    hazardsLen: proBot.state.hazards.length
  })
  check(proBot.state.bike.x <= 42000, 'ENDURANCE_WORLD_X_REBASED', {
    step: i,
    bikeX: proBot.state.bike.x,
    worldOffsetX: proBot.state.worldOffsetX
  })
}
console.log('[PASS] 15,000-step endurance & memory stability OK')
console.log('ALL_8_DIAGNOSTIC_SUITES_PASSED_OK', {
  flipsDone,
  landingsDone,
  bestScore: proBot.state.bestScore
})
