import { approvedParticipant, calculateRankingData } from '../../functions/domain/ranking.js'
import { compareRankingScores, rankingEntries } from './rankingPresentation.js'
import { getMatchCondition, getMatchOutcome, getMatchState, MATCH_STATE } from './match.js'
import { normalizeSetScores, validateFinalSets, validateSportScores } from './sportRules.js'
import { normalizeTieBreak } from './tieBreak.js'
import { buildInterclassStandings } from './interclassStandings.js'
import { getGameShift } from './schoolShifts.js'

const sorted = (users, totals) => rankingEntries(users.filter(approvedParticipant).map((user) => ({ ...user, ...totals.get(user.id) })).sort((a, b) => compareRankingScores(a, b) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')))
const nameForOutcome = (game) => { const side = getMatchOutcome(game); return side === 'A' || side === 'B' ? game[`time${side}`] : side === 'draw' ? 'Empate' : 'Sem resultado' }

export function buildResultImpact({ games, users, predictions, teams = [] }, gameId, candidate) {
  const current = games.find((game) => game.id === gameId)
  if (!current) throw new Error('A partida não está mais disponível.')
  if (candidate.expectedScoreRevision != null && candidate.expectedScoreRevision !== Number(current.scoreRevision || 0)) throw new Error('O placar mudou. Feche a prévia e confira os valores atuais.')
  const reopening = candidate.status === 'aberto'
  if (!reopening && (getMatchCondition(current) !== 'normal' || current.status === 'aberto')) throw new Error('Encerre os palpites e confira a situação da partida antes de publicar o resultado.')
  let next
  if (reopening) next = { ...current, ...candidate, placarA: null, placarB: null, tieBreak: null, status: 'aberto', liveStatus: 'scheduled', matchCondition: 'normal' }
  else {
    const [placarA, placarB] = validateSportScores(current, candidate.placarA, candidate.placarB, { final: true })
    if (current.currentSet?.a || current.currentSet?.b) throw new Error('Encerre o set em andamento antes de finalizar a partida.')
    validateFinalSets(current, placarA, placarB, normalizeSetScores(candidate.setScores ?? current.setScores))
    const tieBreak = normalizeTieBreak(current, candidate.tieBreak === undefined ? current.tieBreak : candidate.tieBreak, placarA, placarB, { final: true })
    next = { ...current, ...candidate, placarA, placarB, tieBreak, status: 'finalizado', liveStatus: 'finished' }
  }
  const afterGames = games.map((game) => game.id === gameId ? next : game)
  const beforeTotals = calculateRankingData({ users, games, predictions }).totals
  const afterTotals = calculateRankingData({ users, games: afterGames, predictions }).totals
  const before = new Map(sorted(users, beforeTotals).map((entry) => [entry.participant.id, entry]))
  const ranking = sorted(users, afterTotals).map((entry) => {
    const prior = before.get(entry.participant.id)
    return { id: entry.participant.id, nome: entry.participant.nome, beforePoints: prior.participant.pontos, afterPoints: entry.participant.pontos, beforePosition: prior.position, afterPosition: entry.position }
  }).filter((row) => row.beforePoints !== row.afterPoints || row.beforePosition !== row.afterPosition)
  const beforeTables = buildInterclassStandings(games, teams), afterTables = buildInterclassStandings(afterGames, teams)
  const standings = []
  for (const table of afterTables) {
    const previous = beforeTables.find((item) => item.id === table.id)
    for (const [index, row] of table.rows.entries()) {
      const priorIndex = previous?.rows.findIndex((item) => item.id === row.id) ?? -1
      const prior = previous?.rows[priorIndex]
      if (prior && (prior.pontos !== row.pontos || priorIndex !== index || prior.saldo !== row.saldo)) standings.push({ team: row.nome, group: table.groupName, beforePoints: prior.pontos, afterPoints: row.pontos, beforePosition: priorIndex + 1, afterPosition: index + 1 })
    }
  }
  const scope = afterGames.filter((game) => game.sportId === current.sportId && (game.tournamentId || '') === (current.tournamentId || '') && getGameShift(game) === getGameShift(current))
  const group = buildInterclassStandings(scope, teams).find((table) => table.groupName === current.groupName)
  const groupComplete = scope.filter((game) => game.stageType === 'group' && game.groupName === current.groupName).every(getMatchOutcome)
  const nextMatches = [], related = []
  for (const game of games) for (const side of ['A', 'B']) {
    let proposed, reason
    if (game[`sourceGameId${side}`] === gameId || (current.nextGameId === game.id && current.nextGameSlot === side)) {
      const outcome = getMatchOutcome(next)
      const winner = outcome === 'A' || outcome === 'B' ? outcome : null
      const winnerSide = game[`sourceOutcome${side}`] === 'loser' && winner ? winner === 'A' ? 'B' : 'A' : winner
      proposed = winnerSide ? next[`time${winnerSide}`] : 'A definir'
      reason = game[`sourceOutcome${side}`] === 'loser' ? 'Perdedor da partida' : 'Vencedor da partida'
    } else if (current.groupName && game.sportId === current.sportId && (game.tournamentId || '') === (current.tournamentId || '') && getGameShift(game) === getGameShift(current)) {
      const seed = game[`qualifierSeed${side}`] || game[`seedLabel${side}`] || ''
      const match = seed.match(/^(\d+)\s*[oº°]\s+(.+)$/i)
      const groupName = game[`qualifierGroup${side}`] || match?.[2]
      if (match && groupName === current.groupName && group && (reopening || groupComplete)) { proposed = reopening ? 'A definir' : group.rows[Number(match[1]) - 1]?.nome || 'A definir'; reason = seed }
    }
    if (proposed === undefined) continue
    related.push(game)
    if (proposed !== game[`time${side}`]) nextMatches.push({ id: game.id, side, match: `${game.fase || 'Próxima fase'} · ${game.timeA} × ${game.timeB}`, before: game[`time${side}`], after: proposed, reason })
  }
  const blocked = games.some((game) => (related.includes(game) || (current.stageType === 'group' && current.tournamentId && game.tournamentId === current.tournamentId && game.stageType !== 'group')) && [MATCH_STATE.LIVE, MATCH_STATE.FINISHED].includes(getMatchState(game)))
  return { ranking, standings, nextMatches, blocked, beforeWinner: nameForOutcome(current), afterWinner: nameForOutcome(next), reopening }
}
