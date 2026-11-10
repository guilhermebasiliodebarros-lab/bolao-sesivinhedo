import { test } from 'node:test'
import assert from 'node:assert/strict'
import { automaticPredictionDeadline, predictionDeadlineInput } from '../src/utils/predictionDeadline.js'

test('the prediction cutoff is exactly five minutes before school-local kickoff, ignoring old custom deadlines', () => {
  for (const limitePalpites of ['', '2099-11-10T08:00', '2099-11-10T10:30']) {
    const game = { dataHora: '2099-11-10T10:00', limitePalpites }
    assert.equal(automaticPredictionDeadline(game).toISOString(), '2099-11-10T12:55:00.000Z')
    assert.equal(predictionDeadlineInput(game), '2099-11-10T09:55')
  }
  const instant = new Date('2099-11-10T13:00:00Z')
  for (const dataHora of [instant, instant.toISOString(), { toDate: () => instant }]) assert.equal(predictionDeadlineInput({ dataHora }), '2099-11-10T09:55')
})

test('the cutoff crosses midnight, month and leap-year boundaries and never invents dates for an unscheduled game', () => {
  assert.equal(predictionDeadlineInput({ dataHora: '2028-03-01T00:03' }), '2028-02-29T23:58')
  assert.equal(predictionDeadlineInput({ dataHora: '2099-01-01T00:01' }), '2098-12-31T23:56')
  for (const game of [{}, { dataHora: '' }, { dataHora: 'invalid' }, { limitePalpites: '2099-11-10T09:55' }]) {
    assert.equal(automaticPredictionDeadline(game), null)
    assert.equal(predictionDeadlineInput(game), '')
  }
})
