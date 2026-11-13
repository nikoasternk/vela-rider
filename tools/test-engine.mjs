import fs from 'fs'
import path from 'path'
import vm from 'vm'

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
    uxRaw.includes('axisTick: 12'),
  'OPTIMIZED_CHART_SPEC_AND_SETTINGS',
  {}
)

const filesToScan = [
  'src/common/engine.js',
  'src/pages/index/index.ux',
  'tools/gen-icon.mjs',
  'src/app.ux'
]
for (const file of filesToScan) {
  const txt = fs.readFileSync(path.resolve(file), 'utf8')
  const hasComment =
    /(^|\s)\/\//.test(txt) || txt.includes('/*') || txt.includes('<!--')
  check(!hasComment, 'ZERO_COMMENTS_IN_' + file, { file })
}

const source = fs.readFileSync(path.resolve('src/common/engine.js'), 'utf8')
let openBraces = 0
for (let i = 0; i < source.length; i++) {
  if (source[i] === '{') openBraces += 1
  else if (source[i] === '}') openBraces -= 1
}
check(openBraces === 0 && source.trim().endsWith('}'), 'ENGINE_JS_SYNTAX_COMPLETE', {
  openBraces,
  totalLines: source.split('\n').length
})

const cjsSource =
  source.replace(/export const /g, 'const ').replace(/export function /g, 'function ') +
  '\nmodule.exports = { VIEW_W, VIEW_H, CHART_POINTS, POINT_STEP, BIKE_SCREEN_X, SECTION_LENGTH, RAINBOW_COLORS, computeRainbowTrackColor, createGameEngine };'
const sandbox = { module: { exports: {} }, Math, Array, Boolean }
vm.runInNewContext(cjsSource, sandbox, { filename: 'src/common/engine.js' })

const {
  createGameEngine,
  computeRainbowTrackColor,
  RAINBOW_COLORS,
  SECTION_LENGTH,
  CHART_POINTS,
  POINT_STEP,
  VIEW_W,
  VIEW_H
} = sandbox.module.exports

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

console.log('[TEST 2/10] Checking LVGL integer chart grid (13 pts, 192x216) & C1 continuity...')
const engine = createGameEngine(1337)
engine.startGame()
check(
  CHART_POINTS === 13 && POINT_STEP === 16 && VIEW_W === 192 && (CHART_POINTS - 1) * POINT_STEP === VIEW_W,
  'EXACT_INTEGER_CHART_GRID',
  { CHART_POINTS, POINT_STEP, VIEW_W }
)
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
console.log('[PASS] LVGL integer chart grid & C1 continuity OK')

console.log('[TEST 3/10] Checking gradual acceleration, booster pad & clean coasting brake...')
const accEngine = createGameEngine(2026)
accEngine.startGame()
const initialSpeed = accEngine.state.bike.speed
accEngine.step(0.016, true)
const afterOneFrameSpeed = accEngine.state.bike.speed
check(
  initialSpeed === 40 && afterOneFrameSpeed - initialSpeed < 6.0 && afterOneFrameSpeed > initialSpeed,
  'GRADUAL_ACCELERATION',
  { initialSpeed, afterOneFrameSpeed }
)
for (let i = 0; i < 30; i++) accEngine.step(0.016, true)
const speedBeforeBrake = accEngine.state.bike.speed
for (let i = 0; i < 40; i++) accEngine.step(0.016, false)
check(
  speedBeforeBrake > 125 && accEngine.state.bike.speed === 0,
  'BRAKE_TO_ZERO_ON_FLAT',
  { speedBeforeBrake, speedAfterBrake: accEngine.state.bike.speed }
)
check(accEngine.state.boosters.length >= 1, 'BOOSTER_PADS_GENERATED', {
  boosters: accEngine.state.boosters.length
})
console.log('[PASS] Gradual acceleration, booster pad & clean braking OK')

console.log('[TEST 4/10] Checking pure Newtonian centripetal takeoff (v^2*k > g*cos)...')
const launchEngine = createGameEngine(2026)
launchEngine.startGame()
const overSeg = launchEngine.state.segs.find((s) => s.overSawZone && s.m1 > 1.0)
check(Boolean(overSeg), 'FIND_CURVED_CREST', {})
launchEngine.state.bike.x = overSeg.x0 - 12
launchEngine.state.bike.y = overSeg.y0 - 6
launchEngine.state.bike.speed = 230
launchEngine.state.bike.onGround = true
let naturalTakeoff = false
for (let i = 0; i < 15; i++) {
  launchEngine.step(0.016, true)
  if (!launchEngine.state.bike.onGround && launchEngine.state.bike.vy < -90) {
    naturalTakeoff = true
    break
  }
}
check(naturalTakeoff, 'NEWTONIAN_CENTRIPETAL_TAKEOFF', {
  onGround: launchEngine.state.bike.onGround,
  vy: launchEngine.state.bike.vy
})
console.log('[PASS] Pure Newtonian centripetal takeoff OK')

console.log('[TEST 5/10] Checking Over-Peak Saw (fly into saw on gas, roll under when braking)...')
const hitBot = createGameEngine(2026)
hitBot.startGame()
const crestHit = hitBot.state.segs.find((s) => s.overSawZone && s.m1 > 1.0)
hitBot.state.bike.x = crestHit.x0 - 10
hitBot.state.bike.y = crestHit.y0 - 6
hitBot.state.bike.speed = 220
hitBot.state.bike.onGround = true
for (let i = 0; i < 45; i++) {
  hitBot.step(0.016, true)
  if (hitBot.state.status === 'gameover') break
}
check(
  hitBot.state.status === 'gameover' && hitBot.state.crashReason === 'ПИЛА!',
  'OVER_PEAK_SAW_HIT_ON_FULL_GAS',
  { status: hitBot.state.status, crashReason: hitBot.state.crashReason }
)

const safeBot = createGameEngine(2026)
safeBot.startGame()
const crestSafe = safeBot.state.segs.find((s) => s.overSawZone && s.m1 > 1.0)
const overSaw = safeBot.state.hazards.find((h) => Math.abs(h.x - (crestSafe.x0 + 66)) < 5)
check(Boolean(overSaw), 'FIND_OVER_PEAK_SAW', {})
safeBot.state.bike.x = crestSafe.x0 - 30
safeBot.state.bike.y = crestSafe.y0 + 18
safeBot.state.bike.speed = 135
safeBot.state.bike.onGround = true
let minClearance = 9999
for (let i = 0; i < 125; i++) {
  safeBot.step(0.016, false)
  const d = Math.hypot(overSaw.x - safeBot.state.bike.x, overSaw.y - safeBot.state.bike.y)
  if (d < minClearance) minClearance = d
  check(safeBot.state.status === 'playing', 'OVER_PEAK_SAW_SAFE_ROLL_STEP_' + i, {
    step: i,
    status: safeBot.state.status,
    crashReason: safeBot.state.crashReason,
    minClearance
  })
}
check(
  safeBot.state.bike.x > crestSafe.x0 + 110 && minClearance > 26,
  'OVER_PEAK_SAW_CLEARANCE_GAP',
  { bikeX: safeBot.state.bike.x, targetX: crestSafe.x0 + 110, minClearance }
)
console.log('[PASS] Over-Peak Saw kinematics OK:', { minClearance: Math.round(minClearance) })

console.log('[TEST 6/10] Checking On-Road Pit Saw (must jump over at speed)...')
const jumpEngine = createGameEngine(2026)
jumpEngine.startGame()
const roadSaw = jumpEngine.state.hazards[jumpEngine.state.hazards.length - 1]
check(Boolean(roadSaw), 'FIND_ON_ROAD_SAW', {})
jumpEngine.state.bike.x = roadSaw.x - 90
jumpEngine.state.bike.y = roadSaw.y + 40
jumpEngine.state.bike.speed = 235
jumpEngine.state.bike.onGround = true
for (let i = 0; i < 65; i++) {
  const b = jumpEngine.state.bike
  const hold = b.onGround || b.airFlips < 1 || b.angle > 0.35
  jumpEngine.step(0.016, hold)
  check(jumpEngine.state.status === 'playing', 'JUMP_OVER_SAW_STEP_' + i, {
    step: i,
    crashReason: jumpEngine.state.crashReason,
    bikeX: b.x,
    bikeY: b.y
  })
}
check(jumpEngine.state.bike.x > roadSaw.x + 30, 'CLEARED_ON_ROAD_SAW', {
  bikeX: jumpEngine.state.bike.x,
  roadSawX: roadSaw.x
})
console.log('[PASS] On-Road Saw jump OK')

console.log('[TEST 7/10] Checking abyss fall & reckless hold crash...')
const abyssFallBot = createGameEngine(2026)
abyssFallBot.startGame()
const firstAbyss = abyssFallBot.state.segs.find((s) => s.abyss)
abyssFallBot.state.bike.x = firstAbyss.x0 - 2
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

console.log('[TEST 8/10] Checking zoom invariance with dynamic airborne zoom...')
const zoom100 = createGameEngine(7777)
const zoom70 = createGameEngine(7777)
const zoom125 = createGameEngine(7777)
zoom100.state.zoomScale = 1.0
zoom70.state.zoomScale = 0.72
zoom125.state.zoomScale = 1.25
zoom100.startGame()
zoom70.startGame()
zoom125.startGame()
for (let i = 0; i < 800; i++) {
  if (zoom100.state.status !== 'playing') {
    zoom100.startGame()
    zoom70.startGame()
    zoom125.startGame()
  }
  const b = zoom100.state.bike
  const hold = (b.onGround && !b.onSteepDrop) || (!b.onGround && (b.airFlips < 1 || b.angle > 0.35))
  zoom100.step(0.016, hold)
  zoom70.step(0.016, hold)
  zoom125.step(0.016, hold)
  check(
    zoom100.state.bike.x === zoom70.state.bike.x &&
      zoom100.state.bike.x === zoom125.state.bike.x &&
      zoom100.state.bike.y === zoom70.state.bike.y &&
      zoom100.state.bike.y === zoom125.state.bike.y &&
      zoom100.state.bike.speed === zoom70.state.bike.speed &&
      zoom100.state.bike.speed === zoom125.state.bike.speed &&
      zoom100.state.bike.angle === zoom70.state.bike.angle &&
      zoom100.state.bike.angle === zoom125.state.bike.angle &&
      zoom100.state.status === zoom70.state.status &&
      zoom100.state.status === zoom125.state.status,
    'ZOOM_PHYSICS_INVARIANCE_STEP_' + i,
    { step: i, x100: zoom100.state.bike.x, x70: zoom70.state.bike.x }
  )
}
console.log('[PASS] Zoom invariance OK (bit-for-bit identical)')

console.log('[TEST 9/10] Running Rider-skill proBot (manual timing, no air auto-leveling)...')
const proBot = createGameEngine(2026)
proBot.startGame()
let flipsDone = 0
let landingsDone = 0
let crashesCount = 0
for (let i = 0; i < 3000; i++) {
  if (proBot.state.status !== 'playing') {
    crashesCount += 1
    proBot.startGame()
  }
  const b = proBot.state.bike
  const hold = (b.onGround && !b.onSteepDrop) || (!b.onGround && (b.airFlips < 1 || b.angle > 0.35))
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
check(flipsDone >= 12 && landingsDone >= 10, 'PROBOT_FLIPS_AND_LANDINGS', {
  flipsDone,
  landingsDone,
  crashesCount
})
console.log('[PASS] proBot skill verification OK:', { flipsDone, landingsDone, crashesCount })

console.log('[TEST 10/10] Running 15,000-step endurance & memory stability test...')
for (let i = 0; i < 15000; i++) {
  if (proBot.state.status !== 'playing') proBot.startGame()
  const b = proBot.state.bike
  const hold = (b.onGround && !b.onSteepDrop) || (!b.onGround && (b.airFlips < 1 || b.angle > 0.35))
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
  check(proBot.state.boosters.length <= 16, 'ENDURANCE_BOOSTERS_BOUNDED', {
    step: i,
    boostersLen: proBot.state.boosters.length
  })
  check(proBot.state.bike.x <= 42000, 'ENDURANCE_WORLD_X_REBASED', {
    step: i,
    bikeX: proBot.state.bike.x
  })
}
console.log('[PASS] 15,000-step endurance & memory stability OK')
console.log('ALL_10_RIDER_V14_SUITES_PASSED_OK', {
  flipsDone,
  landingsDone,
  bestScore: proBot.state.bestScore
})
