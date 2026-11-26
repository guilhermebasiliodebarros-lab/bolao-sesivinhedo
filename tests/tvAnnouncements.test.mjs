import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeTVAnnouncement } from '../src/utils/tvAnnouncements.js'

const start = Date.parse('2026-11-26T13:00:00.000Z')
const message = { id: 'now', type: 'chamada', text: 'Atenção, próximo jogo na Quadra 2.', publishedAt: { toDate: () => new Date(start) } }

test('the TV displays the manual notice only during its shared 30-second window', () => {
  assert.deepEqual(activeTVAnnouncement(message, start), { id: 'now', type: 'chamada', text: message.text, publishedAt: start, expiresAt: start + 30_000 })
  assert.equal(activeTVAnnouncement(message, start + 29_999).id, 'now')
  assert.equal(activeTVAnnouncement(message, start + 30_000), null)
  assert.equal(activeTVAnnouncement(message, start + 50_000), null)
})

test('an uncommitted or invalid notice cannot overlay the TV', () => {
  for (const change of [{ id: '' }, { publishedAt: null }, { publishedAt: 'invalid' }, { publishedAt: new Date(start + 60_000) }, { text: '' }, { type: 'unknown' }]) {
    assert.equal(activeTVAnnouncement({ ...message, ...change }, start), null)
  }
})
