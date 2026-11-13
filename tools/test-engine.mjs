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

console.log('[TEST 1/7] Checking rainbow color interpolation...')
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

console.log('[TEST 2/7] Checking world generation & universal viewport...')
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
check(engine.state.segs.some((s) => s.steepDrop), 'HAS_HIGH_MOUNTAIN_STEEP_DROP', {
  segsCount: engine.state.segs.length
})
check(engine.state.hazards.length >= 3, 'HAS_SAWS_GENERATED', {
  hazardsCount: engine.state.hazards.length
})

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
console.log('[PASS] World generation & universal viewport OK')

console.log('[TEST 3/7] Checking bike complete stop when button is released...')
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

console.log('[TEST 4/7] Checking high mountain overhanging red saw physics...')
const steepSawHitBot = createGameEngine(2026)
steepSawHitBot.startGame()
const steepSeg = steepSawHitBot.state.segs.find((s) => s.steepDrop)
check(Boolean(steepSeg), 'FIND_STEEP_DROP_SEG', { segs: steepSawHitBot.state.segs.length })
steepSawHitBot.state.bike.x = steepSeg.x0 - 8
steepSawHitBot.state.bike.y = steepSeg.y0 - 6
steepSawHitBot.state.bike.speed = 175
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
const steepSegSafe = steepSawSafeBot.state.segs.find((s) => s.steepDrop)
steepSawSafeBot.state.bike.x = steepSegSafe.x0 - 30
steepSawSafeBot.state.bike.y = steepSegSafe.y0 - 6
steepSawSafeBot.state.bike.speed = 165
steepSawSafeBot.state.bike.onGround = true
for (let i = 0; i < 95; i++) {
  steepSawSafeBot.step(0.016, false)
  check(steepSawSafeBot.state.status === 'playing', 'MOUNTAIN_SAW_SAFE_DESCENT_STEP_' + i, {
    step: i,
    status: steepSawSafeBot.state.status,
    crashReason: steepSawSafeBot.state.crashReason,
    bikeX: steepSawSafeBot.state.bike.x,
    bikeY: steepSawSafeBot.state.bike.y,
    speed: steepSawSafeBot.state.bike.speed
  })
}
check(
  steepSawSafeBot.state.bike.x > steepSegSafe.x0 + 115,
  'MOUNTAIN_SAW_SAFE_DESCENT_CLEARED',
  {
    bikeX: steepSawSafeBot.state.bike.x,
    targetX: steepSegSafe.x0 + 115
  }
)
console.log('[PASS] High mountain overhanging red saw physics OK')

console.log('[TEST 5/7] Checking abyss fall & reckless hold crash...')
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
    crashReason: abyssFallBot.state.crashReason,
    bikeX: abyssFallBot.state.bike.x,
    bikeY: abyssFallBot.state.bike.y
  }
)

const holdBot = createGameEngine(2026)
holdBot.startGame()
for (let i = 0; i < 400; i++) {
  holdBot.step(0.016, true)
  if (holdBot.state.status === 'gameover') break
}
check(holdBot.state.status === 'gameover', 'RECKLESS_HOLD_BOT_CRASHES', {
  status: holdBot.state.status,
  bikeX: holdBot.state.bike.x
})
console.log('[PASS] Abyss fall & reckless hold crash OK')

console.log('[TEST 6/7] Running proBot skill verification (3000 steps)...')
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

console.log('[TEST 7/7] Running 15,000-step endurance & memory stability test...')
for (let i = 0; i < 15000; i++) {
  if (proBot.state.status !== 'playing') {
    proBot.startGame()
  }
  const b = proBot.state.bike
  const hold = (b.onGround && !b.onSteepDrop) || (!b.onGround && b.airFlips < 1)
  proBot.step(0.016, hold)
  check(proBot.state.segs.length <= 28, 'ENDURANCE_SEGS_BOUNDED', {
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
console.log('ALL_7_DIAGNOSTIC_SUITES_PASSED_OK', {
  flipsDone,
  landingsDone,
  bestScore: proBot.state.bestScore
})
