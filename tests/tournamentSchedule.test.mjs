import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScheduleRedistribution, orderRoundRobinGames, roundRobinRounds, scheduleRestSummary } from '../src/utils/tournamentSchedule.js'
import { eventDate } from '../src/utils/tvSchedule.js'

const now = new Date('2026-11-06T12:00:00Z')
const groups = [['9B', '1A', '3B', '2B'], ['2A', '1B', '3A', '9A']]
function fixtures() {
  const games = []
  groups.forEach((teams, group) => teams.forEach((timeA, index) => teams.slice(index + 1).forEach((timeB) => {
    const at = new Date(Date.UTC(2026, 10, 30, 10, 10 + games.length * 12))
    games.push({ id: `game-${games.length}`, sportId: 'football', tournamentId: 'cup', timeA, timeB, groupName: `Grupo ${group ? 'B' : 'A'}`, stageType: 'group', status: 'aberto', dataHora: at.toISOString(), limitePalpites: new Date(at.getTime() - 3600000).toISOString() })
  })))
  return games
}

test('round robin covers every pair once with no repeated team inside a round, including odd groups', () => {
  for (let count = 2; count <= 12; count += 1) {
    const teams = Array.from({ length: count }, (_, index) => `Team${index}`)
    const rounds = roundRobinRounds(teams)
    const pairs = rounds.flat()
    assert.equal(pairs.length, count * (count - 1) / 2)
    assert.equal(new Set(pairs.map(({ timeA, timeB }) => [timeA, timeB].sort().join('|'))).size, pairs.length)
    rounds.forEach((round) => assert.equal(new Set(round.flatMap((pair) => [pair.timeA, pair.timeB])).size, round.length * 2))
  }
})

test('two four-team groups replace repeated games with at least two other matches between appearances', () => {
  const games = fixtures()
  const ordered = orderRoundRobinGames(games)
  assert.equal(scheduleRestSummary(games).consecutive, 8)
  assert.deepEqual(scheduleRestSummary(ordered), { consecutive: 0, minimumGap: 2 })
  assert.deepEqual(new Set(ordered.map((game) => game.id)), new Set(games.map((game) => game.id)))
  const plan = buildScheduleRedistribution(games, now)
  const ninth = plan.after.filter((game) => [game.timeA, game.timeB].includes('9B'))
  assert.deepEqual(ninth.map((game) => eventDate(game.dataHora).toISOString().slice(11, 16)), ['10:10', '10:58', '11:46'])
  assert.deepEqual(plan.after.map((game) => eventDate(game.dataHora).getTime()).sort(), games.map((game) => eventDate(game.dataHora).getTime()).sort())
  plan.after.forEach((game) => assert.equal(eventDate(game.dataHora) - eventDate(game.limitePalpites), 300000))
  assert.equal(buildScheduleRedistribution(plan.after, now).changes.length, 0)
})

test('knockouts, started, completed, cancelled and past matches never move', () => {
  const fixed = [
    { id: 'semi', stageType: 'knockout', seedLabelA: '1o Grupo A' },
    { id: 'final', stageType: 'knockout', sourceGameIdA: 'semi' },
    { id: 'live', liveStatus: 'live' }, { id: 'old', startedAt: now }, { id: 'done', status: 'finalizado' },
    { id: 'cancel', matchCondition: 'cancelled' }, { id: 'postpone', matchCondition: 'postponed' }, { id: 'past', dataHora: '2020-11-30T10:00' },
  ].map((fields) => ({ ...fixtures()[0], ...fields }))
  const plan = buildScheduleRedistribution([...fixtures(), ...fixed], now)
  assert.equal(plan.after.length, 12)
  assert(plan.changes.every((change) => !fixed.some((game) => game.id === change.id)))
})

test('redistribution preserves the day and physical area slots and never worsens an existing order', () => {
  const games = fixtures().map((game, index) => ({ ...game, venue: index < 6 ? 'Quadra 1' : 'Quadra 2' }))
  const plan = buildScheduleRedistribution(games, now)
  plan.after.forEach((game) => assert(games.some((old) => old.venue === game.venue && old.dataHora === game.dataHora)))
  const partial = fixtures().slice(0, 3)
  const ordered = orderRoundRobinGames(partial)
  assert.equal(ordered.length, 3)
  assert.equal(new Set(ordered.map((game) => game.id)).size, 3)
  assert(buildScheduleRedistribution(partial, now).afterSummary.consecutive <= scheduleRestSummary(partial).consecutive)
})
