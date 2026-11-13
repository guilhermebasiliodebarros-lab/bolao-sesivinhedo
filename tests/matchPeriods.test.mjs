import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchPeriod, planPeriodChange } from '../src/utils/matchPeriods.js'

const now = new Date('2026-11-13T15:00:00Z')
const game = { esporteNome: 'Futebol', status: 'encerrado', liveStatus: 'live', matchCondition: 'normal', durationMinutes: 20, clock: { elapsedMs: 427000, runningSince: null } }

test('periods are inferred per modality and sets remain controlled by volleyball scores', () => {
  assert.equal(matchPeriod(game, now).label, '1º tempo')
  assert.equal(matchPeriod({ ...game, clock: { elapsedMs: 620000, runningSince: null } }, now).exceeded, true)
  assert.equal(matchPeriod(game, now).exceeded, false)
  assert.equal(matchPeriod({ ...game, esporteNome: 'Handebol' }, now).total, 2)
  assert.equal(matchPeriod({ ...game, esporteNome: 'Basquete' }, now).label, '1º período')
  const volley = matchPeriod({ ...game, esporteNome: 'Vôlei', liveScoreA: 1 }, now)
  assert.equal(volley.label, '2º set'); assert.equal(volley.supported, false)
  assert.equal(matchPeriod({ ...game, esporteNome: 'Xadrez' }, now).supported, false)
})

test('interval and next period preserve accumulated minutes and reset only the displayed period clock', () => {
  const interval = planPeriodChange(game, { action: 'interval' }, now)
  assert.equal(interval.clockAction, 'pause')
  const paused = { ...game, period: interval.period }
  assert.equal(matchPeriod(paused, now).label, 'Intervalo · 1º tempo')
  const next = planPeriodChange(paused, { action: 'next' }, now)
  assert.equal(next.clockAction, 'resume')
  assert.equal(next.period.startedElapsedMs, 427000)
  const value = matchPeriod({ ...game, period: next.period, clock: { elapsedMs: 427000, runningSince: now } }, new Date(now.getTime() + 65000))
  assert.equal(value.label, '2º tempo'); assert.equal(value.elapsedMs, 65000); assert.equal(value.totalElapsedMs, 492000)
  assert.throws(() => planPeriodChange({ ...game, period: next.period }, { action: 'interval' }, now), /não pode/)
})

test('format is explicit, limited to the first playing period and never advances a finished or unavailable game', () => {
  assert.equal(planPeriodChange(game, { action: 'format', format: 'single' }, now).period.format, 'single')
  for (const input of [{ status: 'finalizado' }, { matchCondition: 'cancelled' }, { deletionPending: 'op' }]) assert.throws(() => planPeriodChange({ ...game, ...input }, { action: 'interval' }, now), /disponível/)
  assert.throws(() => planPeriodChange(game, { action: 'next' }, now), /durante o intervalo/)
  assert.throws(() => planPeriodChange({ ...game, period: { format: 'halves', number: 2 } }, { action: 'format', format: 'quarters' }, now), /primeiro/)
  assert.throws(() => planPeriodChange({ ...game, esporteNome: 'Vôlei' }, { action: 'interval' }, now), /sets/)
})
