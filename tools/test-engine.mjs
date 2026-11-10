import assert from 'assert'
import fs from 'fs'

const source = fs.readFileSync(new URL('../src/common/engine.js', import.meta.url), 'utf8')
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64')
const { createGameEngine, THEMES, SLICE_COUNT } = await import(moduleUrl)

const engine = createGameEngine(1337)
engine.startGame()

assert.strictEqual(engine.state.status, 'playing')
assert.strictEqual(engine.state.sliceY.length, SLICE_COUNT)
assert.strictEqual(THEMES.length, 4)

const startX = engine.state.bike.x
for (let i = 0; i < 60; i++) {
  engine.step(0.016, true)
}
assert(engine.state.bike.x > startX)

engine.state.bike.onGround = false
engine.state.bike.y = 80
engine.state.bike.vy = -120
engine.state.bike.vx = 140
for (let i = 0; i < 35; i++) {
  engine.step(0.016, true)
}
assert.strictEqual(engine.state.bike.onGround, false)
assert(engine.state.bike.airRotation > 3.0)

const snap = engine.getRenderSnapshot()
assert.strictEqual(snap.sliceY.length, 35)
console.log('ENGINE_60FPS_VERIFIED_OK')
