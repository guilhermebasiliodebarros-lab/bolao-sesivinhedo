import { listCompetitions, buildBracket, simulateStandings } from './tournamentExplorer.js'
import { buildAthleteStatistics } from './athleteStatistics.js'
import { getMatchCondition, getMatchOutcome, getMatchState, MATCH_STATE } from './match.js'
import { compareRankingScores, rankingEntries } from './rankingPresentation.js'
import { shiftLabel } from './schoolShifts.js'
import { eventDate } from './tvSchedule.js'
import { formatSportScore } from './sportRules.js'
import { formatNoticeDate } from './scheduleNotices.js'
import { tieBreakSummary } from './tieBreak.js'

const settled = (game) => getMatchState(game) === MATCH_STATE.FINISHED || getMatchCondition(game) === 'cancelled'
const equalPerformance = (a, b) => a && b && ['pontos', 'vitorias', 'saldo', 'pro'].every((key) => a[key] === b[key])
export function buildFinalReport(data, labels = {}) {
  const games = data.games || [], teams = data.teams || []
  const pending = games.filter((game) => !settled(game)).length
  const played = games.filter((game) => getMatchState(game) === MATCH_STATE.FINISHED).length
  const competitions = listCompetitions(games)
  const champions = competitions.map((competition) => {
    const bracket = buildBracket(competition.games)
    let champion = bracket.champion
    let situation = champion ? 'Campeão definido' : 'Campeão não definido'
    const leagueOnly = competition.games.every((game) => game.stageType === 'league')
    if (!champion && leagueOnly && competition.games.every(settled) && competition.games.some((game) => getMatchOutcome(game))) {
      const table = simulateStandings(competition.games, {}, teams).tables[0]
      if (table?.rows.length && !equalPerformance(table.rows[0], table.rows[1])) { champion = table.rows[0].nome; situation = 'Liderança final da competição' }
      else if (table?.rows.length) situation = 'Empate na liderança; decisão pendente'
    }
    return { sport: competition.sportName, shift: shiftLabel(competition.turno), tournament: competition.name, champion: champion || '', situation }
  })
  const standings = competitions.flatMap((competition) => simulateStandings(competition.games, {}, teams).tables)
  const ranking = rankingEntries([...(data.ranking || [])].sort((a, b) => compareRankingScores(a, b) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')))
  const results = [...games].sort((a, b) => ((eventDate(a.dataHora).getTime() || Infinity) - (eventDate(b.dataHora).getTime() || Infinity)) || String(a.id).localeCompare(String(b.id))).map((game) => {
    const state = getMatchState(game), condition = getMatchCondition(game)
    const score = state === MATCH_STATE.FINISHED && Number.isFinite(game.placarA) && Number.isFinite(game.placarB) ? `${formatSportScore(game.placarA)} × ${formatSportScore(game.placarB)}` : '-'
    const situation = condition === 'walkover' ? `W.O. · ${['A', 'B'].includes(game.walkoverWinner) ? game[`time${game.walkoverWinner}`] : 'Conferir vencedor'}` : condition === 'cancelled' ? 'Cancelado' : condition === 'postponed' ? 'Adiado' : state === MATCH_STATE.FINISHED ? 'Finalizado' : state === MATCH_STATE.LIVE ? 'Ao vivo; resultado pendente' : 'Agendado'
    return { id: game.id, date: game.dataHora ? formatNoticeDate(game.dataHora) : 'Sem horário', sport: game.esporteNome || 'Modalidade', phase: [game.fase, game.tournamentName].filter(Boolean).join(' · '), match: `${game.timeA} × ${game.timeB}`, score, situation: game.tieBreak ? `${situation} · ${tieBreakSummary(game)}` : situation }
  })
  return { generatedAt: data.generatedAt || new Date().toISOString(), labels, status: pending ? 'parcial' : 'final', total: games.length, played, pending, cancelled: games.filter((game) => getMatchCondition(game) === 'cancelled').length, walkovers: games.filter((game) => getMatchCondition(game) === 'walkover').length, champions, standings, ranking, athletes: buildAthleteStatistics(games, { finishedOnly: true }).filter((group) => group.rows.length), results }
}
