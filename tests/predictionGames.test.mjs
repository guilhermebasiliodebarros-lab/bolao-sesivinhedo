import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupPredictionGames, getGameStageLabel } from '../src/utils/game.js'

const game = (id, extra = {}) => ({ id, sportId: 'futsal', esporteNome: 'Futsal', tournamentId: 'oficial-manha', fase: 'Fase de grupos', turno: 'manha', rodada: `Jogo ${id} · 2026-11-30`, ...extra })

test('individual schedule numbers share one prediction grid without losing their labels or order', () => {
  const games = [game('1'), game('2'), game('3')]
  const before = structuredClone(games)
  const groups = groupPredictionGames(games)
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].games.map((item) => item.id), ['1', '2', '3'])
  assert.equal(groups[0].stage, 'Fase de grupos - Manhã')
  assert.match(getGameStageLabel(groups[0].games[1]), /Jogo 2/)
  assert.deepEqual(games, before)
})

test('prediction groups keep sports, tournaments, phases and shifts separate', () => {
  const games = [game('1'), game('2', { fase: 'Semifinal', rodada: 'Semifinal 1' }), game('3', { fase: 'Semifinal', rodada: 'Semifinal 2' }), game('4', { turno: 'tarde' }), game('5', { tournamentId: 'outro-torneio' }), game('6', { sportId: 'volei', esporteNome: 'Vôlei' })]
  assert.deepEqual(groupPredictionGames(games).map((group) => group.games.map((item) => item.id)), [['1'], ['2', '3'], ['4'], ['5'], ['6']])
  assert.deepEqual(groupPredictionGames([]), [])
})
