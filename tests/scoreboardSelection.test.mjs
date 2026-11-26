import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSelectedScoreboard, normalizeScoreboardSelection, validScoreboardGameIds } from '../src/utils/scoreboardSelection.js'
import { scorePresentation } from '../src/utils/scorePresentation.js'

const game = (id, extra = {}) => ({ id, esporteNome: 'Basquete', timeA: '9º A', timeB: '9º B', status: 'encerrado', liveStatus: 'live', liveScoreA: 10, liveScoreB: 8, ...extra })

test('standby and malformed selections leave the screen in standby', () => {
  const games = [game('a'), game('b'), game('c', { liveStatus: 'scheduled' })]
  for (const selection of [{ mode: 'standby', gameIds: [] }, { gameIds: ['a', 'b', 'c'] }, { gameIds: ['a', 'a'] }]) {
    assert.equal(buildSelectedScoreboard(games, selection).games.length, 0)
    assert.equal(buildSelectedScoreboard(games, selection).kind, 'empty')
  }
})

test('an existing scheduled preview follows a new live match without waiting for a new selection', () => {
  const before = [game('preview', { liveStatus: 'scheduled' }), game('started', { liveStatus: 'scheduled' })]
  const legacy = { gameIds: ['preview'], revision: 1 }
  assert.deepEqual(buildSelectedScoreboard(before, legacy).games.map((item) => item.id), ['preview'])
  assert.equal(buildSelectedScoreboard(before, legacy).kind, 'upcoming')
  const after = [before[0], { ...before[1], liveStatus: 'live', startedAt: new Date() }]
  assert.equal(buildSelectedScoreboard(after, legacy).mode, 'automatic')
  assert.equal(buildSelectedScoreboard(after, legacy).kind, 'live')
  assert.deepEqual(buildSelectedScoreboard(after, legacy).games.map((item) => item.id), ['started'])
  assert.deepEqual(buildSelectedScoreboard(after).games.map((item) => item.id), ['started'])
})

test('automatic TV shows the two most recently started eligible games in stable order as scores change', () => {
  const games = [
    game('earlier', { startedAt: '2026-11-26T10:00:00-03:00' }),
    game('later', { startedAt: '2026-11-26T10:01:00-03:00' }),
    game('newest', { startedAt: '2026-11-26T10:02:00-03:00' }),
    game('cancelled', { startedAt: '2026-11-26T10:03:00-03:00', matchCondition: 'cancelled' }),
    game('removed', { startedAt: '2026-11-26T10:04:00-03:00', deletionPending: true }),
    game('unresolved', { seedLabelA: 'A definir', startedAt: '2026-11-26T10:05:00-03:00' }),
  ]
  assert.deepEqual(buildSelectedScoreboard(games, { mode: 'automatic' }).games.map((item) => item.id), ['newest', 'later'])
  const updated = games.toReversed().map((item) => ({ ...item, liveScoreA: 19 }))
  assert.deepEqual(buildSelectedScoreboard(updated).games.map((item) => item.id), ['newest', 'later'])
})

test('automatic TV pairs basketball on the left and volleyball on the right regardless of start order', () => {
  const basketball = game('basketball', { startedAt: '2026-11-26T10:01:00-03:00' })
  const volleyball = game('volleyball', { esporteNome: 'Vôlei', startedAt: '2026-11-26T10:02:00-03:00' })
  const duplicate = game('another-basketball', { startedAt: '2026-11-26T10:00:00-03:00' })
  const chess = game('chess', { esporteNome: 'Xadrez', startedAt: '2026-11-26T10:03:00-03:00' })
  assert.deepEqual(buildSelectedScoreboard([basketball, volleyball, chess, duplicate]).games.map((item) => item.id), ['basketball', 'volleyball'])
  const later = { ...basketball, startedAt: '2026-11-26T10:04:00-03:00' }
  assert.deepEqual(buildSelectedScoreboard([volleyball, later]).games.map((item) => item.id), ['basketball', 'volleyball'])
  assert.deepEqual(buildSelectedScoreboard([basketball, { ...volleyball, status: 'finalizado' }]).games.map((item) => item.id), ['basketball'])
})

test('a futsal or handball match takes the whole scoreboard when its block starts', () => {
  const basketball = game('basketball', { startedAt: '2026-11-26T10:01:00-03:00' })
  const volleyball = game('volleyball', { esporteNome: 'Vôlei', startedAt: '2026-11-26T10:02:00-03:00' })
  for (const esporteNome of ['Futsal', 'Futebol', 'Handebol']) {
    const match = game('single', { esporteNome, startedAt: '2026-11-26T10:03:00-03:00' })
    assert.deepEqual(buildSelectedScoreboard([basketball, match, volleyball]).games.map((item) => item.id), ['single'])
    assert.deepEqual(buildSelectedScoreboard([basketball, { ...match, startedAt: '2026-11-26T10:00:00-03:00' }, volleyball]).games.map((item) => item.id), ['basketball', 'volleyball'])
  }
})

test('Futmesa and other sports still use both slots when none of the court sports are playing', () => {
  const futmesa = game('futmesa', { esporteNome: 'Futmesa', startedAt: '2026-11-26T10:01:00-03:00' })
  const chess = game('chess', { esporteNome: 'Xadrez', startedAt: '2026-11-26T10:00:00-03:00' })
  assert.deepEqual(buildSelectedScoreboard([futmesa, chess]).games.map((item) => item.id), ['futmesa', 'chess'])
})

test('the one selected match fills the screen and two selected matches retain the operator order during scoring', () => {
  const games = [game('a'), game('b'), game('unselected')]
  assert.deepEqual(buildSelectedScoreboard(games, { mode: 'manual', gameIds: ['b'] }).games.map((item) => item.id), ['b'])
  const selection = { mode: 'manual', gameIds: ['b', 'a'] }
  const first = buildSelectedScoreboard(games, selection)
  const updated = buildSelectedScoreboard(games.reverse().map((item) => ({ ...item, liveScoreA: 99 })), selection)
  assert.deepEqual(first.games.map((item) => item.id), ['b', 'a'])
  assert.deepEqual(updated.games.map((item) => item.id), ['b', 'a'])
  assert.deepEqual(updated.games.map((item) => item.liveScoreA), [99, 99])
})

test('finishing selected games preserves their final scores instead of replacing them with other matches', () => {
  const selected = { mode: 'manual', gameIds: ['a', 'b'] }
  const games = [game('a', { status: 'finalizado', placarA: 30, placarB: 28 }), game('b'), game('unselected')]
  const model = buildSelectedScoreboard(games, selected)
  assert.equal(model.games.length, 2)
  assert.deepEqual(scorePresentation(model.games[0]).values, [30, 28])
  assert.deepEqual(model.live.map((item) => item.id), ['b'])
  assert.equal(buildSelectedScoreboard(games.map((item) => ({ ...item, status: 'finalizado' })), selected).kind, 'results')
})

test('deleted, cancelled or postponed selections leave no replacement from a different court', () => {
  for (const change of [{ deletionPending: { requested: true } }, { matchCondition: 'cancelled' }, { matchCondition: 'postponed' }]) {
    const model = buildSelectedScoreboard([game('a', change), game('b'), game('unselected')], { mode: 'manual', gameIds: ['a', 'b'] })
    assert.deepEqual(model.games.map((item) => item.id), ['b'])
    assert.equal(model.unavailable, 1)
  }
  assert.equal(buildSelectedScoreboard([game('unselected')], { mode: 'manual', gameIds: ['missing'] }).games.length, 0)
})

test('preselecting a scheduled match shows only that match and does not invent a zero score', () => {
  const model = buildSelectedScoreboard([game('next', { liveStatus: '' }), game('playing')], { mode: 'manual', gameIds: ['next'] })
  assert.equal(model.kind, 'upcoming')
  assert.deepEqual(model.games.map((item) => item.id), ['next'])
  assert.equal(scorePresentation(model.games[0]).values, null)
})

test('selection values allow at most two distinct document IDs and use an explicit revision', () => {
  assert.equal(validScoreboardGameIds(['a', 'b']), true)
  for (const value of [['a', 'a'], ['a', 'b', 'c'], ['a/path'], [''], [' a'], [123], null]) assert.equal(validScoreboardGameIds(value), false)
  assert.deepEqual(normalizeScoreboardSelection(), { gameIds: [], revision: 0, mode: 'automatic' })
  assert.deepEqual(normalizeScoreboardSelection({ gameIds: ['a'], revision: 3 }), { gameIds: ['a'], revision: 3, mode: 'automatic' })
  assert.deepEqual(normalizeScoreboardSelection({ mode: 'standby', gameIds: ['a'], revision: 3 }), { gameIds: [], revision: 3, mode: 'standby' })
})
