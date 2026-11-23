import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScheduleChange, mergeReadNoticeIds, normalizeScheduleNotice, unreadScheduleNotices } from '../src/utils/scheduleNotices.js'

const game = { id: 'one', esporteNome: 'Futebol', timeA: '9º A', timeB: '9º B', dataHora: '2026-11-30T09:00', venue: 'Quadra 1', venueArea: 'Principal' }
test('schedule notices describe real time, venue and condition changes without publishing private reasons', () => {
  const change = buildScheduleChange(game, { ...game, dataHora: '2026-11-30T09:30', venue: 'Quadra 2', matchCondition: 'postponed', conditionReason: 'Motivo privado', playerName: 'Nome completo privado' })
  assert.deepEqual(change.fields, ['time', 'venue', 'condition'])
  assert.equal(change.previous.dateTime, '2026-11-30T12:00:00.000Z')
  assert.equal(change.current.dateTime, '2026-11-30T12:30:00.000Z')
  assert.equal(change.current.venue, 'Quadra 2')
  assert(!JSON.stringify(change).includes('privado'))
  assert.equal(buildScheduleChange(game, { ...game, dataHora: '2026-11-30T12:00:00Z', venue: ' quadra 1 ', placarA: 3, liveScoreA: 2 }), null)
  assert.equal(buildScheduleChange(null, game), null)
})

test('malformed notice records cannot break the participant screen', () => {
  assert.equal(normalizeScheduleNotice('bad', { changes: 'invalid' }), null)
  assert.equal(normalizeScheduleNotice('bad', { changes: [null, {}, { gameId: 'one', fields: 'venue' }] }), null)
  const normalized = normalizeScheduleNotice('one', { changes: [{ gameId: 'game', fields: ['venue', 'private-field'], timeA: 9, current: { venue: 'Quadra' } }] })
  assert.deepEqual(normalized.changes[0].fields, ['venue'])
  assert.equal(normalized.changes[0].timeA, '9')
  assert.equal(normalized.changes[0].previous.venue, '')
})

test('new schedules and rescheduling preserve the before and after, including missing dates', () => {
  const first = buildScheduleChange({ ...game, dataHora: '' }, game)
  assert.equal(first.previous.dateTime, '')
  assert.deepEqual(first.fields, ['time'])
  const reschedule = buildScheduleChange({ ...game, matchCondition: 'postponed' }, { ...game, dataHora: '2026-12-01T09:00' })
  assert.deepEqual(reschedule.fields, ['time', 'condition'])
})

test('read receipts do not hide newly arriving notices and stay bounded without duplicates', () => {
  const merged = mergeReadNoticeIds(['old', 'same'], ['new', 'same'])
  assert.deepEqual(merged, ['new', 'same', 'old'])
  assert.deepEqual(unreadScheduleNotices([{ id: 'new' }, { id: 'later' }], merged), [{ id: 'later' }])
  assert.equal(mergeReadNoticeIds(Array.from({ length: 150 }, (_, index) => `n-${index}`), []).length, 100)
  assert.deepEqual(mergeReadNoticeIds([], ['bad/path', '', null, 'ok']), ['ok'])
})
