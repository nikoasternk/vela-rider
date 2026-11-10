import assert from 'assert'
import { createGameEngine, THEMES } from '../src/common/engine.js'

const engine = createGameEngine(1337)
engine.startGame()

assert.strictEqual(engine.state.status, 'playing')
assert.strictEqual(engine.state.columns.length, 21)
assert.strictEqual(THEMES.length, 4)

const startX = engine.state.bike.x
for (let i = 0; i < 60; i++) {
  engine.step(0.03, true)
}
assert(engine.state.bike.x > startX)

engine.state.bike.onGround = false
engine.state.bike.y = 80
engine.state.bike.vy = -120
engine.state.bike.vx = 140
for (let i = 0; i < 55; i++) {
  engine.step(0.03, true)
}
assert(engine.state.bike.airRotation > 3.0)

const snap = engine.getRenderSnapshot()
assert.strictEqual(snap.columns.length, 21)
assert.strictEqual(snap.particles.length, 6)
assert.strictEqual(snap.gems.length, 2)
console.log('ENGINE_VERIFIED_OK')
