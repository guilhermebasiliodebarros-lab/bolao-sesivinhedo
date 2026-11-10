import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scorePresentation } from '../src/utils/scorePresentation.js'
import { getMatchScore } from '../src/utils/match.js'
import { createSharedSubscriptions } from '../src/utils/sharedSubscriptions.js'
import { getRealtimeStatus, subscribeRealtimeStatus, updateRealtimeStatus } from '../src/services/realtimeStatus.js'
import { hasPendingWrites, trackWrite } from '../src/services/pendingWrites.js'
import { trackPageEdits } from '../src/utils/pageEdits.js'

test('a volleyball point changes the display while its set totals and result remain independent', () => {
  const game = { id: 'volley', esporteNome: 'Vôlei', status: 'encerrado', liveStatus: 'live', liveScoreA: 1, liveScoreB: 0, currentSet: { a: 7, b: 5 }, setScores: [{ a: 25, b: 23 }] }
  assert.equal(scorePresentation(game).text, '7 × 5')
  assert.equal(scorePresentation(game).caption, '2º set · pontos · Sets: 1 × 0')
  assert.equal(scorePresentation({ ...game, currentSet: { a: 8, b: 5 } }).text, '8 × 5')
  assert.deepEqual(getMatchScore(game), [1, 0])
  assert.equal(scorePresentation(game).partials, '1º: 25–23')
  const ended = { ...game, liveScoreA: 2, currentSet: { a: 0, b: 0 } }
  assert.equal(scorePresentation(ended).text, '2 × 0')
  assert.equal(scorePresentation(ended).caption, 'Sets: 2 × 0')
  assert.equal(scorePresentation({ ...game, status: 'finalizado', placarA: 2, placarB: 1 }).text, '2 × 1')
})
test('live goals, basketball points, chess draws, unscheduled and W.O. games retain their units', () => {
  const game = { status: 'encerrado', liveStatus: 'live', esporteNome: 'Futebol', liveScoreA: 2, liveScoreB: 1 }
  assert.equal(scorePresentation(game).text, '2 × 1')
  assert.equal(scorePresentation({ ...game, esporteNome: 'Basquete', liveScoreA: 37, liveScoreB: 31 }).text, '37 × 31')
  assert.equal(scorePresentation({ esporteNome: 'Xadrez', status: 'finalizado', placarA: .5, placarB: .5 }).text, '½ × ½')
  assert.equal(scorePresentation({ status: 'aberto' }).text, '×')
  assert.equal(scorePresentation({ status: 'finalizado', matchCondition: 'walkover' }).text, 'W.O.')
})
test('equivalent active feeds share a connection, user filters stay separate and released data is discarded', () => {
  let created = 0, stopped = 0, removed = 0
  const pool = createSharedSubscriptions({ equal: (a, b) => a.path === b.path && a.userId === b.userId, create: () => { created++; return { subscribe: () => () => stopped++ } }, onRemove: () => removed++ })
  const offA = pool({ path: 'predictions', userId: 'alice' })
  const offB = pool({ path: 'predictions', userId: 'alice' })
  const offC = pool({ path: 'predictions', userId: 'bob' })
  assert.equal(created, 2)
  offA(); offA(); assert.equal(stopped, 1); assert.equal(removed, 0)
  offB(); assert.equal(removed, 1)
  const offD = pool({ path: 'predictions', userId: 'alice' })
  assert.equal(created, 3)
  offC(); offD(); assert.equal(removed, 3)
})
test('global connection state includes every active feed and clears when feeds recover or unmount', () => {
  const first = {}, second = {}
  let notices = 0
  const stop = subscribeRealtimeStatus(() => notices++)
  updateRealtimeStatus(first, { state: 'live' })
  updateRealtimeStatus(second, { state: 'reconnecting' })
  assert.equal(getRealtimeStatus().state, 'reconnecting')
  updateRealtimeStatus(second, { state: 'live' })
  assert.equal(getRealtimeStatus().state, 'live')
  const stable = getRealtimeStatus()
  updateRealtimeStatus(first, { state: 'live', lastServerAt: Date.now() })
  assert.equal(getRealtimeStatus(), stable)
  updateRealtimeStatus(first, { state: 'offline' })
  assert.equal(getRealtimeStatus().state, 'offline')
  updateRealtimeStatus(first, null); updateRealtimeStatus(second, null)
  assert.equal(getRealtimeStatus().state, 'idle')
  assert.equal(notices, 6)
  stop()
})
test('pending writes protect all forms until every request completes, including failures', async () => {
  let finish, fail
  const first = trackWrite(() => new Promise((resolve) => { finish = resolve }))
  const second = trackWrite(() => new Promise((resolve, reject) => { fail = reject }))
  assert.equal(hasPendingWrites(), true)
  finish('saved'); assert.equal(await first, 'saved'); assert.equal(hasPendingWrites(), true)
  fail(new Error('network'))
  await assert.rejects(second, /network/)
  assert.equal(hasPendingWrites(), false)
})
test('automatic version updates defer edits, recent interaction and dialogs without serializing form data', () => {
  const doc = new EventTarget()
  let now = 0, dialog = false
  doc.querySelector = () => dialog ? {} : null
  const tracker = trackPageEdits(doc, () => now)
  const field = { value: 'initial', defaultValue: 'initial', type: 'text', isConnected: true, matches: () => true, closest: (selector) => selector === '[data-update-safe]' ? null : {} }
  const send = (name) => { const event = new Event(name); Object.defineProperty(event, 'target', { value: field }); doc.dispatchEvent(event) }
  send('focusin'); field.value = 'unsaved'; send('input')
  now = 6000; assert.equal(tracker.hasPendingChanges(), true)
  field.value = 'initial'; send('input'); assert.equal(tracker.hasPendingChanges(), true)
  now += 6000; assert.equal(tracker.hasPendingChanges(), false)
  field.value = 'unsaved'; send('change'); now += 6000; field.isConnected = false
  assert.equal(tracker.hasPendingChanges(), false)
  dialog = true; assert.equal(tracker.hasPendingChanges(), true)
  dialog = false; tracker.dispose()
  assert.equal(tracker.hasPendingChanges(), false)
})
