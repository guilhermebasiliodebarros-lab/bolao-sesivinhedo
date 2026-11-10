import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orderQuickGames, quickScoreOptions, validQuickScore } from '../src/utils/quickPredictions.js'
import { resolveAppView } from '../src/utils/navigation.js'

test('quick score choices cover valid volleyball winners for both match formats and all chess outcomes', () => {
  for (const volleyballBestOf of [3, 5]) {
    const game = { esporteNome: 'Vôlei', volleyballBestOf }
    const target = Math.ceil(volleyballBestOf / 2)
    const options = quickScoreOptions(game)
    assert.equal(options.length, target * 2)
    assert.equal(new Set(options.map(({ a, b }) => `${a}:${b}`)).size, target * 2)
    for (const option of options) { assert.equal(validQuickScore(game, option.a, option.b), true); assert.equal(Math.max(option.a, option.b), target) }
    assert.equal(validQuickScore(game, target, target), false)
    assert.equal(validQuickScore(game, 0, 0), false)
  }
  const chess = { esporteNome: 'Xadrez' }
  assert.deepEqual(quickScoreOptions(chess), [{ a: 1, b: 0 }, { a: .5, b: .5 }, { a: 0, b: 1 }])
  for (const option of quickScoreOptions(chess)) assert.equal(validQuickScore(chess, option.a, option.b), true)
  assert.equal(validQuickScore(chess, 0, 0), false)
})
test('quick entry requires two explicit nonnegative integer scores for goals and points', () => {
  for (const esporteNome of ['Futebol', 'Basquete', 'Handebol']) {
    const game = { esporteNome }
    assert.deepEqual(quickScoreOptions(game), [])
    assert.equal(validQuickScore(game, '', ''), false)
    assert.equal(validQuickScore(game, '0', ''), false)
    assert.equal(validQuickScore(game, '0', '0'), true)
    assert.equal(validQuickScore(game, '-1', '2'), false)
    assert.equal(validQuickScore(game, '.5', '2'), false)
    assert.equal(validQuickScore(game, '72', '69'), true)
    assert.equal(validQuickScore(game, '10001', '1'), false)
  }
})
test('quick queue prioritizes the nearest closing game without mutating the subscription order', () => {
  const games = [{ id: 'late', dataHora: '2026-11-10T16:00' }, { id: 'undated' }, { id: 'soon', dataHora: '2026-11-10T14:00' }]
  assert.deepEqual(orderQuickGames(games).map((game) => game.id), ['soon', 'late', 'undated'])
  assert.deepEqual(games.map((game) => game.id), ['late', 'undated', 'soon'])
})
test('mobile landing uses Jogos while preserving the four participant routes and master restrictions', () => {
  const mobile = { signedIn: true, isMaster: false, participantHome: 'jogos' }
  for (const requested of ['home', 'login', 'cadastro', 'admin', 'tv', 'unknown']) assert.equal(resolveAppView(requested, mobile), 'jogos')
  for (const requested of ['dashboard', 'jogos', 'palpites', 'classificacao']) assert.equal(resolveAppView(requested, mobile), requested)
  assert.equal(resolveAppView('jogos', { ...mobile, signedIn: false }), 'login')
  assert.equal(resolveAppView('jogos', { ...mobile, isMaster: true }), 'admin')
  assert.equal(resolveAppView('home', { ...mobile, isMaster: true }), 'home')
})
