import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSelectedScoreboard, normalizeScoreboardSelection, validScoreboardGameIds } from '../src/utils/scoreboardSelection.js'
import { scorePresentation } from '../src/utils/scorePresentation.js'

const game = (id, extra = {}) => ({ id, esporteNome: 'Basquete', timeA: '9º A', timeB: '9º B', status: 'encerrado', liveStatus: 'live', liveScoreA: 10, liveScoreB: 8, ...extra })

test('an empty or malformed selection never falls back to any of the other live or scheduled games', () => {
  const games = [game('a'), game('b'), game('c', { liveStatus: 'scheduled' })]
  for (const selection of [{}, { gameIds: [] }, { gameIds: ['a', 'b', 'c'] }, { gameIds: ['a', 'a'] }]) {
    assert.equal(buildSelectedScoreboard(games, selection).games.length, 0)
    assert.equal(buildSelectedScoreboard(games, selection).kind, 'empty')
  }
})

test('the one selected match fills the screen and two selected matches retain the operator order during scoring', () => {
  const games = [game('a'), game('b'), game('unselected')]
  assert.deepEqual(buildSelectedScoreboard(games, { gameIds: ['b'] }).games.map((item) => item.id), ['b'])
  const first = buildSelectedScoreboard(games, { gameIds: ['b', 'a'] })
  const updated = buildSelectedScoreboard(games.reverse().map((item) => ({ ...item, liveScoreA: 99 })), { gameIds: ['b', 'a'] })
  assert.deepEqual(first.games.map((item) => item.id), ['b', 'a'])
  assert.deepEqual(updated.games.map((item) => item.id), ['b', 'a'])
  assert.deepEqual(updated.games.map((item) => item.liveScoreA), [99, 99])
})

test('finishing selected games preserves their final scores instead of replacing them with other matches', () => {
  const selected = { gameIds: ['a', 'b'] }
  const games = [game('a', { status: 'finalizado', placarA: 30, placarB: 28 }), game('b'), game('unselected')]
  const model = buildSelectedScoreboard(games, selected)
  assert.equal(model.games.length, 2)
  assert.deepEqual(scorePresentation(model.games[0]).values, [30, 28])
  assert.deepEqual(model.live.map((item) => item.id), ['b'])
  assert.equal(buildSelectedScoreboard(games.map((item) => ({ ...item, status: 'finalizado' })), selected).kind, 'results')
})

test('deleted, cancelled or postponed selections leave no replacement from a different court', () => {
  for (const change of [{ deletionPending: { requested: true } }, { matchCondition: 'cancelled' }, { matchCondition: 'postponed' }]) {
    const model = buildSelectedScoreboard([game('a', change), game('b'), game('unselected')], { gameIds: ['a', 'b'] })
    assert.deepEqual(model.games.map((item) => item.id), ['b'])
    assert.equal(model.unavailable, 1)
  }
  assert.equal(buildSelectedScoreboard([game('unselected')], { gameIds: ['missing'] }).games.length, 0)
})

test('preselecting a scheduled match shows only that match and does not invent a zero score', () => {
  const model = buildSelectedScoreboard([game('next', { liveStatus: '' }), game('playing')], { gameIds: ['next'] })
  assert.equal(model.kind, 'upcoming')
  assert.deepEqual(model.games.map((item) => item.id), ['next'])
  assert.equal(scorePresentation(model.games[0]).values, null)
})

test('selection values allow at most two distinct document IDs and use an explicit revision', () => {
  assert.equal(validScoreboardGameIds(['a', 'b']), true)
  for (const value of [['a', 'a'], ['a', 'b', 'c'], ['a/path'], [''], [' a'], [123], null]) assert.equal(validScoreboardGameIds(value), false)
  assert.deepEqual(normalizeScoreboardSelection(), { gameIds: [], revision: 0 })
  assert.deepEqual(normalizeScoreboardSelection({ gameIds: ['a'], revision: 3 }), { gameIds: ['a'], revision: 3 })
})
