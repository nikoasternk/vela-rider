import assert from 'assert'
import fs from 'fs'

const source = fs.readFileSync(new URL('../src/common/engine.js', import.meta.url), 'utf8')
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64')
const { createGameEngine, CHART_POINTS } = await import(moduleUrl)

const engine = createGameEngine(1337)
engine.startGame()

assert.strictEqual(engine.state.status, 'playing')
assert.strictEqual(engine.state.chartData.length, CHART_POINTS)

const startX = engine.state.bike.x
for (let i = 0; i < 45; i++) {
  engine.step(0.02, true)
}
assert(engine.state.bike.x > startX)

engine.state.bike.onGround = false
engine.state.bike.y = 60
engine.state.bike.vy = -140
engine.state.bike.vx = 160
for (let i = 0; i < 24; i++) {
  engine.step(0.02, true)
}
assert.strictEqual(engine.state.bike.onGround, false)
assert(engine.state.bike.airRotation > 3.0)

const snap = engine.getRenderSnapshot()
assert.strictEqual(snap.chartData.length, 21)
assert(snap.trackColor.startsWith('#'))
console.log('ENGINE_V2_VERIFIED_OK')
