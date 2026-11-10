import assert from 'assert'
import fs from 'fs'

const workflowRaw = fs.readFileSync(
  new URL('../.github/workflows/build.yml', import.meta.url),
  'utf8'
)
assert(workflowRaw.includes('workflow_dispatch:'))
assert(!workflowRaw.includes('push:'))

const manifestRaw = JSON.parse(
  fs.readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8')
)
assert.strictEqual(manifestRaw.package, 'com.band.rider')

const source = fs.readFileSync(new URL('../src/common/engine.js', import.meta.url), 'utf8')
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64')
const {
  createGameEngine,
  computeRainbowTrackColor,
  RAINBOW_COLORS,
  SECTION_LENGTH,
  CHART_POINTS,
  CHART_Y_MAX
} = await import(moduleUrl)

assert.strictEqual(RAINBOW_COLORS.length, 7)
for (let i = 0; i < 7; i++) {
  const cStart = computeRainbowTrackColor(i * SECTION_LENGTH + 50)
  const cMid = computeRainbowTrackColor(i * SECTION_LENGTH + 600)
  assert.strictEqual(cStart, RAINBOW_COLORS[i])
  assert.strictEqual(cMid, RAINBOW_COLORS[i])
}

const engine = createGameEngine(1337)
engine.startGame()

assert.strictEqual(engine.state.status, 'playing')
assert.strictEqual(engine.state.chartData.length, CHART_POINTS)
assert(engine.state.segs.filter((s) => s.abyss).length >= 8)
assert(engine.state.segs.filter((s) => s.island).length >= 6)
assert(engine.state.segs.some((s) => s.steepDrop))
assert(engine.state.hazards.some((h) => h.descentSaw))

for (const [vw, vh] of [
  [200, 300],
  [196, 188],
  [176, 136]
]) {
  engine.setViewport(vw, vh)
  const snap = engine.getRenderSnapshot()
  assert.strictEqual(snap.viewW, vw)
  assert.strictEqual(snap.viewH, vh)
  for (let i = 0; i < snap.chartData.length; i++) {
    assert(snap.chartData[i] > 4 && snap.chartData[i] < CHART_Y_MAX - 4)
  }
}

engine.setViewport(200, 300)
engine.state.zoomScale = 0.72
engine.step(0.016, true)
const snapFar = engine.getRenderSnapshot()
assert.strictEqual(snapFar.chartData.length, CHART_POINTS)

engine.state.zoomScale = 1.0
let prevSpeed = engine.state.bike.speed
for (let i = 0; i < 14; i++) {
  engine.step(0.016, true)
  if (engine.state.bike.onGround) {
    assert(engine.state.bike.speed >= prevSpeed)
    prevSpeed = engine.state.bike.speed
  }
}

const steepSeg = engine.state.segs.find((s) => s.steepDrop)
assert(steepSeg)

const recklessBot = createGameEngine(2026)
recklessBot.startGame()
recklessBot.state.bike.x = steepSeg.x0 - 8
recklessBot.state.bike.y = steepSeg.y0 - 6
recklessBot.state.bike.speed = 180
recklessBot.state.bike.onGround = true
for (let i = 0; i < 60; i++) {
  recklessBot.step(0.016, true)
  if (recklessBot.state.status === 'gameover') break
}
assert.strictEqual(recklessBot.state.status, 'gameover')
assert.strictEqual(recklessBot.state.crashReason, 'ПИЛА!')

const carefulBot = createGameEngine(2026)
carefulBot.startGame()
carefulBot.state.bike.x = steepSeg.x0 - 8
carefulBot.state.bike.y = steepSeg.y0 - 6
carefulBot.state.bike.speed = 160
carefulBot.state.bike.onGround = true
for (let i = 0; i < 60; i++) {
  carefulBot.step(0.016, false)
  assert.strictEqual(carefulBot.state.status, 'playing')
}
assert(carefulBot.state.bike.x > steepSeg.x0 + 90)

const holdBot = createGameEngine(2026)
holdBot.startGame()
for (let i = 0; i < 400; i++) {
  holdBot.step(0.016, true)
  if (holdBot.state.status === 'gameover') break
}
assert.strictEqual(holdBot.state.status, 'gameover')

const idleBot = createGameEngine(2026)
idleBot.startGame()
for (let i = 0; i < 400; i++) {
  idleBot.step(0.016, false)
  if (idleBot.state.status === 'gameover') break
}
assert.strictEqual(idleBot.state.status, 'gameover')

const proBot = createGameEngine(2026)
proBot.startGame()
let flipsDone = 0
let landingsDone = 0
for (let i = 0; i < 3000; i++) {
  if (proBot.state.status !== 'playing') {
    proBot.startGame()
  }
  const b = proBot.state.bike
  const nearSteep = proBot.state.segs.some(
    (s) => s.steepDrop && b.x >= s.x0 - 15 && b.x <= s.x1
  )
  const hold = nearSteep ? false : b.onGround || b.airFlips < 1
  const res = proBot.step(0.016, hold)
  if (res.event === 'flip') flipsDone += 1
  if (res.event === 'land') landingsDone += 1

  const snap = proBot.getRenderSnapshot()
  for (let j = 0; j < snap.chartData.length; j++) {
    assert(snap.chartData[j] >= 4 && snap.chartData[j] <= CHART_Y_MAX - 4)
  }
}
assert(flipsDone >= 15)
assert(landingsDone >= 15)
console.log('ENGINE_V10_UNIVERSAL_ALL_TESTS_PASSED_OK', {
  flipsDone,
  landingsDone
})
