import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimReminder, reminderCandidates } from '../src/utils/predictionReminders.js'
const game = { id: 'one', status: 'aberto', timeA: 'A', timeB: 'B', dataHora: '2026-11-10T15:00:00Z' }
const at = (time) => new Date(`2026-11-10T${time}:00Z`)
test('reminders concern unsubmitted predictions before the five-minute cutoff, including unsent drafts', () => {
  assert.equal(reminderCandidates([game], [], at('14:44'), 10).length, 0)
  assert.equal(reminderCandidates([game], [], at('14:45'), 10).length, 1)
  assert.equal(reminderCandidates([game], [{ gameId: 'one' }], at('14:46'), 10).length, 0)
  assert.equal(reminderCandidates([game], [], at('14:55'), 10).length, 0)
  for (const fields of [{ status: 'encerrado' }, { liveStatus: 'live' }, { startedAt: new Date() }, { deletionPending: true }, { matchCondition: 'walkover' }, { matchCondition: 'cancelled' }, { matchCondition: 'postponed' }, { dataHora: '' }]) {
    assert.equal(reminderCandidates([{ ...game, ...fields }], [], at('14:50'), 10).length, 0)
  }
})
test('deduplication persists across refreshes and tabs but isolates users and rescheduled games', () => {
  const data = new Map(), target = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) }
  assert.equal(claimReminder('alice', game, at('14:50'), target), true)
  assert.equal(claimReminder('alice', game, at('14:51'), target), false)
  assert.equal(claimReminder('bob', game, at('14:51'), target), true)
  assert.equal(claimReminder('alice', { ...game, dataHora: '2026-11-10T16:00:00Z' }, at('15:50'), target), true)
})
test('blocked storage still deduplicates in the current session', () => {
  const target = { getItem() { throw new Error('blocked') } }, session = new Set()
  assert.equal(claimReminder('alice', game, at('14:50'), target, session), true)
  assert.equal(claimReminder('alice', game, at('14:51'), target, session), false)
})
