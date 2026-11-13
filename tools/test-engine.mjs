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

const uxRaw = fs.readFileSync(path.resolve('src/pages/index/index.ux'), 'utf8')
check(
  uxRaw.includes('<scroll class="settings-window" scroll-y="true"') &&
    uxRaw.includes('cfg-btn'),
  'SETTINGS_SCROLLABLE_LARGE_WINDOW',
  {}
)

const source = fs.readFileSync(new URL('../src/common/engine.js', import.meta.url), 'utf8')
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64')
const {
  createGameEngine,
  computeRainbowTrackColor,
  RAINBOW_COLORS,
  SECTION_LENGTH,
  CHART_POINTS,
  POINT_STEP,
  VIEW_H
} = await import(moduleUrl)

console.log('[TEST 1/10] Checking rainbow color interpolation...')
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

console.log('[TEST 2/10] Checking 41-point high-res chart & C1 abyss continuity...')
const engine = createGameEngine(1337)
engine.startGame()
check(CHART_POINTS === 41 && POINT_STEP === 5, 'HIGH_RES_CHART_GRID', {
  CHART_POINTS,
  POINT_STEP
})
check(engine.state.chartData.length === CHART_POINTS, 'CHART_POINTS_COUNT', {
  len: engine.state.chartData.length
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
console.log('[PASS] 41-point high-res chart & C1 abyss continuity OK')

console.log('[TEST 3/10] Checking gradual acceleration & ultra-fast braking...')
const accEngine = createGameEngine(2026)
accEngine.startGame()
const initialSpeed = accEngine.state.bike.speed
accEngine.step(0.016, true)
const afterOneFrameSpeed = accEngine.state.bike.speed
check(
  initialSpeed === 45 && afterOneFrameSpeed - initialSpeed < 5.0 && afterOneFrameSpeed > initialSpeed,
  'GRADUAL_NON_INSTANT_ACCELERATION',
  { initialSpeed, afterOneFrameSpeed }
)
for (let i = 0; i < 25; i++) {
  accEngine.step(0.016, true)
}
const speedBeforeBrake = accEngine.state.bike.speed
for (let i = 0; i < 25; i++) {
  accEngine.step(0.016, false)
}
check(
  speedBeforeBrake > 110 && accEngine.state.bike.speed === 0,
  'ULTRA_FAST_BRAKING_TO_ZERO',
  { speedBeforeBrake, speedAfterBrake: accEngine.state.bike.speed }
)
console.log('[PASS] Gradual acceleration & ultra-fast braking OK')

console.log('[TEST 4/10] Checking high jump off saw-free mountain...')
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
  if (!freeMountEngine.state.bike.onGround && freeMountEngine.state.bike.vy < -160) {
    launchedHighOffMountain = true
    break
  }
}
check(launchedHighOffMountain, 'FREE_MOUNTAIN_HIGH_JUMP_LAUNCH', {
  vy: freeMountEngine.state.bike.vy
})
console.log('[PASS] High jump off saw-free mountain OK')

console.log('[TEST 5/10] Checking mountain with OVER-PEAK saw (brake to pass under)...')
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
  'OVER_PEAK_SAW_HIT_ON_FULL_GAS',
  { status: steepSawHitBot.state.status, crashReason: steepSawHitBot.state.crashReason }
)

const steepSawSafeBot = createGameEngine(2026)
steepSawSafeBot.startGame()
const peakSegSafe = steepSawSafeBot.state.segs.find((s) => s.peakLaunch)
const mountainSaw = steepSawSafeBot.state.hazards.find((h) => Math.abs(h.x - (peakSegSafe.x0 + 80)) < 5)
steepSawSafeBot.state.bike.x = peakSegSafe.x0 - 25
steepSawSafeBot.state.bike.y = peakSegSafe.y0 + 10
steepSawSafeBot.state.bike.speed = 210
steepSawSafeBot.state.bike.onGround = true
let minDistToOverSaw = 9999
for (let i = 0; i < 120; i++) {
  steepSawSafeBot.step(0.016, false)
  const d = Math.hypot(
    mountainSaw.x - steepSawSafeBot.state.bike.x,
    mountainSaw.y - steepSawSafeBot.state.bike.y
  )
  if (d < minDistToOverSaw) minDistToOverSaw = d
  check(steepSawSafeBot.state.status === 'playing', 'OVER_PEAK_SAW_SAFE_STEP_' + i, {
    step: i,
    minDistToOverSaw
  })
}
check(
  steepSawSafeBot.state.bike.x > peakSegSafe.x0 + 130 && minDistToOverSaw > 26,
  'OVER_PEAK_SAW_SAFE_CLEARANCE',
  { bikeX: steepSawSafeBot.state.bike.x, minDistToOverSaw }
)
console.log('[PASS] Mountain with over-peak saw OK')

console.log('[TEST 6/10] Checking mountain with ON-ROAD saw (must jump over at high speed)...')
const jumpMountEngine = createGameEngine(2026)
jumpMountEngine.startGame()
const kickers90 = jumpMountEngine.state.segs.filter((s) => s.kicker && s.dx === 90)
check(kickers90.length >= 2, 'FIND_MUST_JUMP_MOUNTAIN', { count: kickers90.length })
const mustJumpSeg = kickers90[1]
const roadSaw = jumpMountEngine.state.hazards.find((h) => Math.abs(h.x - (mustJumpSeg.x1 + 65)) < 5)
check(Boolean(roadSaw), 'FIND_ON_ROAD_MOUNTAIN_SAW', {})

jumpMountEngine.state.bike.x = mustJumpSeg.x0 + 30
jumpMountEngine.state.bike.y = mustJumpSeg.y0 - 15
jumpMountEngine.state.bike.speed = 195
jumpMountEngine.state.bike.onGround = true
let minDistJumpOver = 9999
for (let i = 0; i < 55; i++) {
  const b = jumpMountEngine.state.bike
  const hold = b.onGround || b.airFlips < 1
  jumpMountEngine.step(0.016, hold)
  const d = Math.hypot(roadSaw.x - b.x, roadSaw.y - b.y)
  if (d < minDistJumpOver) minDistJumpOver = d
  check(jumpMountEngine.state.status === 'playing', 'MUST_JUMP_MOUNTAIN_AIR_CLEAR_' + i, {
    step: i,
    bikeX: b.x,
    bikeY: b.y,
    minDistJumpOver
  })
}
check(
  jumpMountEngine.state.bike.x > roadSaw.x + 30 && minDistJumpOver > 24,
  'MUST_JUMP_MOUNTAIN_CLEARED_HIGH',
  { bikeX: jumpMountEngine.state.bike.x, roadSawX: roadSaw.x, minDistJumpOver }
)

const slowMountEngine = createGameEngine(2026)
slowMountEngine.startGame()
slowMountEngine.state.bike.x = mustJumpSeg.x1 + 2
slowMountEngine.state.bike.y = mustJumpSeg.y1 - 6
slowMountEngine.state.bike.speed = 105
slowMountEngine.state.bike.onGround = true
for (let i = 0; i < 45; i++) {
  slowMountEngine.step(0.016, false)
  if (slowMountEngine.state.status === 'gameover') break
}
check(
  slowMountEngine.state.status === 'gameover' && slowMountEngine.state.crashReason === 'ПИЛА!',
  'MUST_JUMP_MOUNTAIN_HITS_SAW_IF_NOT_JUMPING',
  { status: slowMountEngine.state.status, crashReason: slowMountEngine.state.crashReason }
)
console.log('[PASS] Mountain with on-road saw (must jump over) OK:', {
  minDistJumpOver: Math.round(minDistJumpOver)
})

console.log('[TEST 7/10] Checking abyss fall & reckless hold crash...')
const abyssFallBot = createGameEngine(2026)
abyssFallBot.startGame()
const firstAbyss = abyssFallBot.state.segs.find((s) => s.abyss)
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
  { status: abyssFallBot.state.status }
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

console.log('[TEST 8/10] Checking zoom invariance (70%, 100%, 130% must have identical physics)...')
const zoom100 = createGameEngine(7777)
const zoom70 = createGameEngine(7777)
const zoom130 = createGameEngine(7777)
zoom100.state.zoomScale = 1.0
zoom70.state.zoomScale = 0.72
zoom130.state.zoomScale = 1.28
zoom100.startGame()
zoom70.startGame()
zoom130.startGame()
for (let i = 0; i < 800; i++) {
  if (zoom100.state.status !== 'playing') {
    zoom100.startGame()
    zoom70.startGame()
    zoom130.startGame()
  }
  const b = zoom100.state.bike
  const hold = (b.onGround && !b.onSteepDrop) || (!b.onGround && b.airFlips < 1)
  zoom100.step(0.016, hold)
  zoom70.step(0.016, hold)
  zoom130.step(0.016, hold)
  check(
    zoom100.state.bike.x === zoom70.state.bike.x &&
      zoom100.state.bike.x === zoom130.state.bike.x &&
      zoom100.state.bike.y === zoom70.state.bike.y &&
      zoom100.state.bike.y === zoom130.state.bike.y &&
      zoom100.state.bike.speed === zoom70.state.bike.speed &&
      zoom100.state.bike.speed === zoom130.state.bike.speed &&
      zoom100.state.bike.angle === zoom70.state.bike.angle &&
      zoom100.state.bike.angle === zoom130.state.bike.angle &&
      zoom100.state.status === zoom70.state.status &&
      zoom100.state.status === zoom130.state.status,
    'ZOOM_PHYSICS_INVARIANCE_STEP_' + i,
    {
      step: i,
      x100: zoom100.state.bike.x,
      x70: zoom70.state.bike.x,
      x130: zoom130.state.bike.x
    }
  )
}
console.log('[PASS] Zoom invariance OK (bit-for-bit identical physics)')

console.log('[TEST 9/10] Running proBot skill verification (3000 steps)...')
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

console.log('[TEST 10/10] Running 15,000-step endurance & memory stability test...')
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
console.log('ALL_10_DIAGNOSTIC_SUITES_PASSED_OK', {
  flipsDone,
  landingsDone,
  bestScore: proBot.state.bestScore
})
