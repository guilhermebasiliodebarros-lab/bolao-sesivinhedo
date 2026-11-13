import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transmissionHealth } from '../src/utils/transmissionHealth.js'

const now = 1000000
const health = (input = {}) => transmissionHealth({ now, startedAt: now - 20000, online: true, connected: true, feeds: [{ name: 'Placares', lastServerAt: now - 2000, maxAgeMs: 75000 }, { name: 'Seleção', lastServerAt: now - 60000, maxAgeMs: 135000 }], ...input })

test('server confirmations, not a moving clock or absence of scoring, determine the TV connection status', () => {
  assert.equal(health().state, 'live')
  assert.equal(health().lastServerAt, now - 60000)
  assert.equal(health({ now: now + 74000 }).state, 'stale')
  assert.equal(health({ connected: false }).state, 'syncing')
  assert.equal(health({ online: false }).state, 'offline')
  assert.equal(health({ error: true }).state, 'reconnecting')
})

test('missing first confirmations time out; reconnection becomes live only after both feeds are confirmed', () => {
  assert.equal(health({ feeds: [{ name: 'Placares', lastServerAt: null }] }).state, 'syncing')
  assert.equal(health({ startedAt: now - 80000, feeds: [{ name: 'Placares', lastServerAt: null }] }).state, 'stale')
  assert.equal(health({ feeds: [{ name: 'Seleção', lastServerAt: now - 136000, maxAgeMs: 135000 }] }).state, 'stale')
  assert.equal(health({ feeds: [{ name: 'Seleção', lastServerAt: now }] }).state, 'live')
})
