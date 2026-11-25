import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPredictionRoster, hasCorrectTopScorer, parsePredictionPlayerKey, predictionPlayerKey, predictionTeamSide, topScorerWinners, usesTopScorer } from '../src/utils/predictionPlayers.js'
import { calcularPontuacao, calculateGuessScore, getScoringRuleText } from '../src/utils/scoring.js'
import { calculateRankingData, gameScoringInput, predictionInput } from '../functions/domain/ranking.js'

const team = { id: 'team-a', nome: '6º A', esporteNome: 'Basquete', sportId: 'basket', turno: 'tarde' }
const match = { id: 'match', esporteNome: 'Basquete', sportId: 'basket', turno: 'tarde', timeA: '6º A', timeB: '6º B', teamIdA: 'team-a', teamIdB: 'team-b', status: 'finalizado', placarA: 20, placarB: 18, scorerStats: [{ side: 'A', playerId: 'ana', playerName: 'Ana', total: 7 }, { side: 'B', playerId: 'bia', playerName: 'Bia', total: 9 }] }
const pick = { userId: 'teacher', id: 'pick', gameId: 'match', palpiteA: 20, palpiteB: 18, topScorerTeamId: 'team-b', topScorerPlayerId: 'bia', topScorerSide: 'B' }

test('only basketball and volleyball expose registered names, and no private roster attributes', () => {
  for (const nome of ['Basquete', 'Basquete 3x3', 'Vôlei', 'Voleibol']) assert.equal(usesTopScorer({ nome }), true)
  for (const nome of ['Futsal', 'Handebol', 'Xadrez', 'Futmesa', 'Mancala', 'Tênis de Mesa']) assert.equal(usesTopScorer({ nome }), false)
  const roster = buildPredictionRoster(team, [{ id: 'bia', nome: 'Bia Silva', posicao: 'Reserva', capitao: true, notes: 'Privado' }, { id: 'ana', nome: 'Ana Silva', phone: 'privado' }, { id: 'empty', nome: ' ' }])
  assert.deepEqual(roster, { teamId: 'team-a', teamName: '6º A', sportId: 'basket', turno: 'tarde', players: [{ id: 'ana', nome: 'Ana Silva' }, { id: 'bia', nome: 'Bia Silva' }] })
  assert.equal(buildPredictionRoster({ ...team, esporteNome: 'Futsal' }, []), null)
})

test('player selections preserve stable IDs and team membership, sport and shift', () => {
  assert.deepEqual(parsePredictionPlayerKey(predictionPlayerKey(team.id, 'ana')), { teamId: team.id, playerId: 'ana' })
  assert.equal(parsePredictionPlayerKey(''), null)
  for (const input of ['broken', '[]', '["a"]', '["a", "b", "c"]', '["a/x", "p"]', '["", "p"]', '{}']) assert.throws(() => parsePredictionPlayerKey(input))
  assert.equal(predictionTeamSide(match, team), 'A')
  assert.equal(predictionTeamSide(match, { ...team, id: 'other' }), '')
  assert.equal(predictionTeamSide(match, { ...team, sportId: 'volley' }), '')
  assert.equal(predictionTeamSide(match, { ...team, turno: 'manha' }), '')
  assert.equal(predictionTeamSide({ ...match, teamIdA: '' }, team), 'A')
  assert.equal(predictionTeamSide({ ...match, seedLabelA: 'Vencedor semifinal' }, team), '')
})

for (const esporteNome of ['Basquete', 'Vôlei']) test(`${esporteNome}: winner and top student score independently; exact scores alone give no bonus`, () => {
  const game = { ...match, esporteNome, placarA: esporteNome === 'Vôlei' ? 2 : 20, placarB: esporteNome === 'Vôlei' ? 1 : 18 }
  const correct = { ...pick, palpiteA: game.placarA, palpiteB: game.placarB }
  assert.deepEqual(calculateGuessScore(game, correct), { points: 2, type: 'winner-scorer' })
  assert.deepEqual(calculateGuessScore(game, { ...correct, palpiteA: game.placarB, palpiteB: game.placarA }), { points: 1, type: 'scorer' })
  assert.deepEqual(calculateGuessScore(game, { ...correct, topScorerPlayerId: 'ana', topScorerTeamId: 'team-a', topScorerSide: 'A' }), { points: 1, type: 'result' })
  assert.deepEqual(calculateGuessScore(game, { palpiteA: game.placarA, palpiteB: game.placarB }), { points: 1, type: 'result' })
  assert.equal(calcularPontuacao(correct.palpiteA, correct.palpiteB, game.placarA, game.placarB, game, correct).acertoExato, false)
  assert.match(getScoringRuleText(game), /aluno/)
  assert.doesNotMatch(getScoringRuleText(game), /placar exato/)
})

test('all tied leaders qualify, including the losing team; equal names or player IDs on other teams do not match', () => {
  const tied = { ...match, scorerStats: [{ side: 'A', playerId: 'bia', total: 9 }, { side: 'B', playerId: 'bia', total: 9 }] }
  assert.equal(topScorerWinners(tied).length, 2)
  assert.equal(hasCorrectTopScorer(tied, pick), true)
  assert.equal(hasCorrectTopScorer(tied, { ...pick, topScorerSide: 'A', topScorerTeamId: 'team-a' }), true)
  assert.equal(hasCorrectTopScorer(match, { ...pick, topScorerSide: 'A', topScorerTeamId: 'team-a' }), false)
  assert.equal(hasCorrectTopScorer(match, { ...pick, topScorerTeamId: 'unrelated' }), false)
})

test('missing, zero, invalid, duplicated or manually reset scorer totals never invent a winning student', () => {
  for (const change of [{ scorerStats: [] }, { scorerStats: {} }, { scorerStats: [null] }, { scorerStats: [{ side: 'A', playerId: 'ana', total: 0 }] }, { scorerStats: [{ side: 'C', playerId: 'ana', total: 9 }] }, { eventsAdjusted: true }, { matchCondition: 'cancelled' }]) {
    assert.deepEqual(topScorerWinners({ ...match, ...change }), [])
    assert.equal(hasCorrectTopScorer({ ...match, ...change }, pick), false)
  }
  assert.equal(topScorerWinners({ ...match, scorerStats: [...match.scorerStats, match.scorerStats[0]] })[0].playerId, 'bia')
})

test('other sports give only one outcome point even on exact scores', () => {
  for (const esporteNome of ['Futmesa', 'Mancala', 'Tênis de Mesa']) {
    assert.deepEqual(calculateGuessScore({ ...match, esporteNome }, pick), { points: 1, type: 'result' })
    assert.doesNotMatch(getScoringRuleText({ esporteNome }), /extra/)
  }
})

test('server ranks, corrections, reopenings and trigger fingerprints include the selected student and final point totals', () => {
  const user = { id: 'teacher', role: 'user', approvalStatus: 'approved', participaRanking: true }
  const data = { users: [user], games: [match], predictions: [pick] }
  const total = calculateRankingData(data).totals.get(user.id)
  assert.equal(total.pontos, 2)
  assert.equal(total.acertosExatos, 0)
  assert.equal(total.acertosPontuador, 1)
  assert.equal(total.rankingPorEsporte.basket.acertosPontuador, 1)
  const changed = { ...match, scorerStats: [{ side: 'A', playerId: 'ana', total: 12 }] }
  assert.equal(calculateRankingData({ ...data, games: [changed] }).totals.get(user.id).pontos, 1)
  assert.equal(calculateRankingData({ ...data, games: [{ ...match, status: 'encerrado' }] }).totals.get(user.id).pontos, 0)
  assert.notEqual(gameScoringInput(match), gameScoringInput(changed))
  assert.equal(gameScoringInput({ ...match, status: 'encerrado' }), gameScoringInput({ ...changed, status: 'encerrado' }))
  assert.notEqual(predictionInput(pick), predictionInput({ ...pick, topScorerPlayerId: 'other' }))
  assert.equal(predictionInput(pick), predictionInput({ ...pick, acertoPontuador: true }))
})
