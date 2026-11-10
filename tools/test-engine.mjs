import assert from 'assert'
import fs from 'fs'

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
assert(engine.state.loops.length >= 1)
assert(engine.state.hazards.length >= 1)

engine.state.zoomScale = 0.72
engine.step(0.016, true)
const snapFar = engine.getRenderSnapshot()
assert.strictEqual(snapFar.chartData.length, CHART_POINTS)

engine.state.zoomScale = 1.0
let prevSpeed = engine.state.bike.speed
for (let i = 0; i < 18; i++) {
  engine.step(0.016, true)
  if (engine.state.bike.onGround) {
    assert(engine.state.bike.speed >= prevSpeed)
    prevSpeed = engine.state.bike.speed
  }
}

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
let loopsCompleted = 0
for (let i = 0; i < 3000; i++) {
  if (proBot.state.status !== 'playing') {
    proBot.startGame()
  }
  const b = proBot.state.bike
  const hold = b.onGround || b.inLoop || b.airFlips < 1
  const res = proBot.step(0.016, hold)
  if (res.event === 'flip') flipsDone += 1
  if (res.event === 'land') landingsDone += 1
  if (proBot.state.bannerText === 'ПЕТЛЯ +5') loopsCompleted += 1

  const snap = proBot.getRenderSnapshot()
  for (let j = 0; j < snap.chartData.length; j++) {
    assert(snap.chartData[j] >= 4 && snap.chartData[j] <= VIEW_H - 4)
  }
}
assert(flipsDone >= 15)
assert(landingsDone >= 15)
assert(loopsCompleted >= 1)
console.log('ENGINE_V8_ALL_TESTS_PASSED_OK', {
  flipsDone,
  landingsDone,
  loopsCompleted
})
