import assert from 'assert'
import fs from 'fs'

const source = fs.readFileSync(new URL('../src/common/engine.js', import.meta.url), 'utf8')
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64')
const { createGameEngine, CHART_POINTS, VIEW_H } = await import(moduleUrl)

const engine = createGameEngine(1337)
engine.startGame()

assert.strictEqual(engine.state.status, 'playing')
assert.strictEqual(engine.state.chartData.length, CHART_POINTS)

engine.state.nodes = [
  { x: 0, y: 260 },
  { x: 500, y: 40 },
  { x: 1000, y: 40 }
]
engine.state.bike.x = 40
engine.state.bike.onGround = true
engine.state.bike.speed = 130

let prevSpeed = engine.state.bike.speed
for (let i = 0; i < 25; i++) {
  engine.step(0.016, true)
  assert(engine.state.bike.speed > prevSpeed)
  prevSpeed = engine.state.bike.speed
}

const stressEngine = createGameEngine(2026)
stressEngine.startGame()
let lastX = stressEngine.state.bike.x
for (let i = 0; i < 2000; i++) {
  if (stressEngine.state.status !== 'playing') {
    stressEngine.startGame()
    lastX = stressEngine.state.bike.x
  }
  const hold = i % 40 < 22
  stressEngine.step(0.016, hold)
  assert(stressEngine.state.bike.x > lastX)
  lastX = stressEngine.state.bike.x

  const snap = stressEngine.getRenderSnapshot()
  for (let j = 0; j < snap.chartData.length; j++) {
    assert(snap.chartData[j] >= 8 && snap.chartData[j] <= VIEW_H - 8)
  }
}

stressEngine.state.bike.onGround = false
stressEngine.state.bike.y = 40
stressEngine.state.bike.vy = -150
stressEngine.state.bike.vx = 180
stressEngine.state.bike.airRotation = 0
stressEngine.state.bike.airFlips = 0
for (let i = 0; i < 25; i++) {
  stressEngine.step(0.016, true)
}
assert(stressEngine.state.bike.airRotation > 4.0)
assert(stressEngine.state.bike.airFlips >= 1)

console.log('ENGINE_V3_STRESS_2000_VERIFIED_OK')
