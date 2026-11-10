import assert from 'assert'
import fs from 'fs'

const source = fs.readFileSync(new URL('../src/common/engine.js', import.meta.url), 'utf8')
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64')
const { createGameEngine, CHART_POINTS, VIEW_H } = await import(moduleUrl)

const engine = createGameEngine(1337)
engine.startGame()

assert.strictEqual(engine.state.status, 'playing')
assert.strictEqual(engine.state.chartData.length, CHART_POINTS)

let prevSpeed = engine.state.bike.speed
for (let i = 0; i < 20; i++) {
  engine.step(0.016, true)
  if (engine.state.bike.onGround) {
    assert(engine.state.bike.speed >= prevSpeed)
    prevSpeed = engine.state.bike.speed
  }
}

const flipEngine = createGameEngine(777)
flipEngine.startGame()
flipEngine.state.bike.onGround = false
flipEngine.state.bike.y = flipEngine.state.bike.y - 120
flipEngine.state.bike.vy = -180
flipEngine.state.bike.vx = 180
flipEngine.state.bike.airRotation = 0
flipEngine.state.bike.airFlips = 0
for (let i = 0; i < 32; i++) {
  flipEngine.step(0.016, true)
}
assert.strictEqual(flipEngine.state.bike.onGround, false)
assert(flipEngine.state.bike.airRotation > 4.5)
assert(flipEngine.state.bike.airFlips >= 1)

const simEngine = createGameEngine(2026)
simEngine.startGame()
let flipsDone = 0
let landingsDone = 0
let lastX = simEngine.state.bike.x
for (let i = 0; i < 5000; i++) {
  if (simEngine.state.status !== 'playing') {
    simEngine.startGame()
    lastX = simEngine.state.bike.x
  }
  const b = simEngine.state.bike
  let hold = true
  if (!b.onGround && b.airFlips >= 1 && Math.abs(b.angle) < 0.35) {
    hold = false
  }
  const res = simEngine.step(0.016, hold)
  if (res.event === 'flip') flipsDone += 1
  if (res.event === 'land') landingsDone += 1
  assert(simEngine.state.bike.x > lastX)
  lastX = simEngine.state.bike.x

  const snap = simEngine.getRenderSnapshot()
  for (let j = 0; j < snap.chartData.length; j++) {
    assert(snap.chartData[j] >= 6 && snap.chartData[j] <= VIEW_H - 6)
  }
}
assert(flipsDone >= 20)
assert(landingsDone >= 15)
console.log('ALL_GOOGLE_GRADE_CHECKS_PASSED_OK', { flipsDone, landingsDone })
