import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAthleteStatistics, statisticsTeamKey, statisticsTournamentKey } from '../src/utils/athleteStatistics.js'
import { applyLiveEvent } from '../src/utils/liveEvents.js'

const stat = (playerId, playerName, total, side = 'A') => ({ playerId, playerName, total, side, minutes: [] })
const game = (id, fields = {}) => ({ id, sportId: 'football', esporteNome: 'Futebol', scoringMode: 'goals', timeA: '9º A', timeB: '9º B', teamIdA: 'teamA', teamIdB: 'teamB', tournamentId: 'cup', tournamentName: 'Interclasse', status: 'finalizado', scorerStats: [], ...fields })

test('individual scoring adds athlete totals across games without merging people who share a first name', () => {
  const tables = buildAthleteStatistics([
    game('one', { scorerStats: [stat('ana', 'Ana Silva Santos', 2), stat('other-ana', 'Ana', 1)] }),
    game('two', { status: 'encerrado', liveStatus: 'live', scorerStats: [stat('ana', 'Ana', 3), stat('bruno', 'Bruno', 2, 'B')] }),
  ])
  const table = tables[0]
  assert.equal(table.rows.length, 3)
  assert.equal(table.rows[0].name, 'Ana')
  assert.equal(table.rows[0].total, 5)
  assert.equal(table.rows[0].liveTotal, 3)
  assert.equal(table.rows[0].games, 2)
  assert.equal(table.recordedTotal, 8)
  assert.equal(JSON.stringify(table).includes('Silva'), false)
  assert.equal(buildAthleteStatistics([game('one', { scorerStats: [stat('ana', 'Ana', 2)] }), game('two', { status: 'encerrado', liveStatus: 'live', scorerStats: [stat('ana', 'Ana', 3)] })], { finishedOnly: true })[0].rows[0].total, 2)
})

test('basketball and volleyball use points, including points from completed sets, with separate modality rankings', () => {
  const tables = buildAthleteStatistics([
    game('football', { scorerStats: [stat('ana', 'Ana', 3)] }),
    game('basket', { sportId: 'basket', esporteNome: 'Basquete', scoringMode: 'points', scorerStats: [stat('ana', 'Ana', 7)] }),
    game('volley', { sportId: 'volley', esporteNome: 'Vôlei', scoringMode: 'sets', placarA: 2, placarB: 0, liveEvents: [], scorerStats: [stat('ana', 'Ana', 39)] }),
  ])
  assert.equal(tables.length, 3)
  assert.equal(tables.find((table) => table.sportId === 'football').unit, 'Gols')
  assert.equal(tables.find((table) => table.sportId === 'basket').rows[0].total, 7)
  assert.equal(tables.find((table) => table.sportId === 'volley').rows[0].total, 39)
  assert.equal(tables.find((table) => table.sportId === 'volley').unit, 'Pontos')
})

test('unattributed, cancelled, postponed, walkover, scheduled and chess records cannot create athlete totals', () => {
  const games = [game('eligible', { scorerStats: [stat('ana', 'Ana', 2), stat('', 'Equipe', 20), stat('bad', 'Invalid', -2)] }), ...[
    { matchCondition: 'cancelled' }, { matchCondition: 'postponed' }, { matchCondition: 'walkover' }, { status: 'aberto' }, { scoringMode: 'chess', esporteNome: 'Xadrez' },
  ].map((fields, index) => game(`excluded-${index}`, { scorerStats: [stat('ana', 'Ana', 99)], ...fields }))]
  const table = buildAthleteStatistics(games)[0]
  assert.equal(table.recordedTotal, 2)
  assert.equal(table.games, 1)
  assert.equal(table.rows.length, 1)
})

test('sport, tournament and team filters stay scoped, while search preserves tied positions', () => {
  const first = game('one', { scorerStats: [stat('ana', 'Ana', 3), stat('bruno', 'Bruno', 3, 'B'), stat('carla', 'Carla', 1)] })
  const games = [first, game('different-cup', { tournamentId: 'other', scorerStats: [stat('ana', 'Ana', 9)] })]
  const table = buildAthleteStatistics(games, { sport: 'football', tournament: statisticsTournamentKey(first) })[0]
  assert.deepEqual(table.rows.map((row) => row.rank), [1, 1, 3])
  assert.equal(buildAthleteStatistics(games, { tournament: statisticsTournamentKey(first), team: statisticsTeamKey(first, 'B') })[0].rows[0].name, 'Bruno')
  assert.equal(buildAthleteStatistics(games, { tournament: statisticsTournamentKey(first), search: 'CÁRLA' })[0].rows[0].rank, 3)
  assert.deepEqual(buildAthleteStatistics(games, { sport: 'chess' }), [])
})

test('later knockout games missing a team ID still use the same athlete and team identity', () => {
  const games = [game('group', { scorerStats: [stat('ana', 'Ana', 2)] }), game('knockout', { teamIdA: '', stageType: 'knockout', scorerStats: [stat('ana', 'Ana', 1)] })]
  const table = buildAthleteStatistics(games)[0]
  assert.equal(table.rows.length, 1)
  assert.equal(table.rows[0].total, 3)
  assert.equal(table.rows[0].games, 2)
  assert.equal(buildAthleteStatistics(games, { team: statisticsTeamKey(games[0], 'A') })[0].rows[0].total, 3)
})

test('undo and manual corrections are reflected directly, without reconstructing truncated recent event history', () => {
  const current = game('live', { status: 'encerrado', liveStatus: 'live', startedAt: '2026-11-06T08:00', liveScoreA: 0, liveScoreB: 0 })
  const now = new Date('2026-11-06T12:00:00Z')
  let updated = current
  let last
  for (let index = 0; index < 12; index += 1) {
    last = applyLiveEvent(updated, { requestId: `goal-${index}`, side: 'A', value: 1 }, { player: { id: 'ana', nome: 'Ana Silva' }, now })
    updated = { ...updated, ...last.after }
  }
  assert.equal(updated.liveEvents.length, 8)
  assert.equal(buildAthleteStatistics([updated])[0].rows[0].total, 12)
  assert.equal(buildAthleteStatistics([{ ...updated, ...last.before }])[0].rows[0].total, 11)
  const corrected = buildAthleteStatistics([{ ...updated, scorerStats: [], eventsAdjusted: true }])[0]
  assert.equal(corrected.rows.length, 0)
  assert.equal(corrected.adjustedGames, 1)
})
