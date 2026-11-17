import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDelayImpact, delayPlanFingerprint, delayScheduleFingerprint, schoolDateTimeInput } from '../src/utils/scheduleDelay.js'

const now = new Date('2099-11-06T08:00:00-03:00')
const match = (id, clock, extra = {}) => ({ id, sportId: 'fut', esporteNome: 'Futebol', timeA: `Equipe ${id} A`, timeB: `Equipe ${id} B`, status: 'aberto', dataHora: clock ? `2099-11-06T${clock}` : '', durationMinutes: 30, venue: 'Quadra 1', ...extra })
const planFor = (games, options = {}, teams = []) => buildDelayImpact(games, teams, { anchorId: 'a', minutes: 15, now, ...options })

test('delay propagates through the court and free gaps absorb it without changing unrelated games', () => {
  const games = [match('a', '09:00'), match('b', '09:30'), match('c', '10:15'), match('other', '09:30', { venue: 'Quadra 2' }), match('undated', '')]
  const original = structuredClone(games)
  const plan = planFor(games)
  assert.deepEqual(plan.changes.map(({ game, after, minutes }) => [game.id, after.dataHora.slice(11), minutes]), [['a', '09:15', 15], ['b', '09:45', 15]])
  assert.deepEqual(plan.issues, [])
  assert.deepEqual(games, original)
  assert.equal(plan.after.find((game) => game.id === 'c').dataHora, games[2].dataHora)
})

test('a class links different sports and a secondary court propagates its resulting delay', () => {
  const games = [match('a', '09:00', { timeA: '9º A', timeB: '9º B', venue: 'Campo' }), match('b', '09:30', { sportId: 'volley', timeA: '9A', timeB: '1A', venue: 'Quadra 2' }), match('c', '10:00', { sportId: 'basket', venue: 'Quadra 2' })]
  const plan = planFor(games)
  assert.deepEqual(plan.changes.map(({ game, after }) => [game.id, after.dataHora.slice(11)]), [['a', '09:15'], ['b', '09:45'], ['c', '10:15']])
  assert(plan.changes[1].reasons.includes('Mesma equipe / turma'))
  assert.deepEqual(plan.issues, [])
})

test('separate physical areas remain independent; a blank area occupies the whole venue', () => {
  const a = match('a', '09:00', { venueArea: 'Basquete' })
  const b = match('b', '09:30', { venueArea: 'Vôlei' })
  assert.deepEqual(planFor([a, b]).changes.map(({ game }) => game.id), ['a'])
  assert.deepEqual(planFor([{ ...a, venueArea: '' }, b]).changes.map(({ game }) => game.id), ['a', 'b'])
})

test('a live or started successor blocks applying a delay and is never moved', () => {
  for (const extra of [{ liveStatus: 'live' }, { startedAt: new Date() }, { deletionPending: { requested: true } }]) {
    const b = match('b', '09:30', extra)
    const plan = planFor([match('a', '09:00'), b])
    assert.equal(plan.after.find((game) => game.id === 'b').dataHora, b.dataHora)
    assert(plan.issues.some(({ message }) => /indisponível|Mesmo local/.test(message)))
  }
})

test('the proposed start also respects earlier fixed court reservations', () => {
  const plan = planFor([match('early', '08:50', { liveStatus: 'live' }), match('a', '09:00')])
  assert.equal(plan.changes[0].after.dataHora.slice(11), '09:20')
  assert.equal(plan.maxDelay, 20)
  assert.deepEqual(plan.issues, [])
})

test('explicit knockout dependencies propagate across different courts, including same-time parents', () => {
  const parent = match('a', '09:00')
  const child = match('b', '09:35', { venue: 'Quadra 2', sourceGameIdA: 'a', seedLabelA: 'Vencedor da semifinal' })
  assert.equal(planFor([parent, child]).changes.find(({ game }) => game.id === 'b').after.dataHora.slice(11), '09:45')
  const sameTimeChild = { ...child, id: '0-child', dataHora: parent.dataHora, venue: parent.venue }
  const plan = planFor([sameTimeChild, parent])
  assert.equal(plan.changes.find(({ game }) => game.id === '0-child').after.dataHora.slice(11), '09:45')
  assert.deepEqual(plan.issues, [])
})

test('missing phase schedules and reachable cycles block the preview while unrelated cycles stay isolated', () => {
  assert(planFor([match('a', '09:00', { sourceGameIdA: 'missing' })]).issues.some(({ message }) => /Fase anterior/.test(message)))
  const cyclic = [match('x', '10:00', { venue: 'Outro local', sourceGameIdA: 'y' }), match('y', '10:30', { venue: 'Outro local', sourceGameIdA: 'x' })]
  assert.deepEqual(planFor([match('a', '09:00'), ...cyclic]).issues, [])
  assert(planFor(cyclic, { anchorId: 'x' }).issues.some(({ message }) => /circular/.test(message)))
})

test('cancellations, postponements, completed games and unknown dates are preserved', () => {
  const skipped = [match('cancelled', '09:30', { matchCondition: 'cancelled' }), match('postponed', '09:30', { matchCondition: 'postponed' }), match('finished', '09:30', { status: 'finalizado' }), match('undated', '')]
  assert.deepEqual(planFor([match('a', '09:00'), ...skipped]).changes.map(({ game }) => game.id), ['a'])
  for (const game of skipped) assert.throws(() => planFor([game], { anchorId: game.id }), /agendada/)
})

test('invalid delays, past proposals and day overflow cannot be applied', () => {
  const games = [match('a', '09:00')]
  for (const minutes of ['', 0, -1, 1.5, 241, 'abc']) assert.throws(() => planFor(games, { minutes }), /atraso/)
  assert(planFor(games, { now: new Date('2099-11-06T09:20:00-03:00') }).issues.some(({ message }) => /já passou/.test(message)))
  assert(planFor([match('a', '23:30')]).issues.some(({ message }) => /ultrapassa o dia/.test(message)))
  assert.equal(schoolDateTimeInput('2099-11-07T02:30:00Z'), '2099-11-06T23:30')
})

test('review fingerprints ignore scoring and input order but include new games, resources and class metadata', () => {
  const games = [match('a', '09:00'), match('b', '09:30')]
  const signature = delayScheduleFingerprint(games)
  assert.equal(delayScheduleFingerprint([...games].reverse().map((game) => ({ ...game, liveScoreA: 5, scoreRevision: 99 }))), signature)
  for (const field of [{ venueArea: 'Nova área' }, { durationMinutes: 45 }, { turmaA: '9º A' }, { sourceGameIdA: 'parent' }, { startedAt: new Date() }]) assert.notEqual(delayScheduleFingerprint([{ ...games[0], ...field }, games[1]]), signature)
  assert.notEqual(delayScheduleFingerprint([...games, match('new', '10:00')]), signature)
  assert.notEqual(delayScheduleFingerprint(games, [{ id: 'team', turma: '9º A' }]), signature)
  assert.notEqual(delayPlanFingerprint(planFor(games)), delayPlanFingerprint(planFor(games, { minutes: 30 })))
})

test('legacy timestamps with seconds round forward without shortening the delay or creating a boundary overlap', () => {
  const games = [match('a', '09:00:34'), match('b', '09:30')]
  const plan = planFor(games)
  assert.equal(plan.changes[0].after.dataHora, '2099-11-06T09:16')
  assert.equal(plan.changes[1].after.dataHora, '2099-11-06T09:46')
  assert.equal(plan.maxDelay, 16)
  assert.deepEqual(plan.issues, [])
})
