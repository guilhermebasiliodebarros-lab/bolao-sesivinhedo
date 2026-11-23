import { normalizeFilterText } from './game.js'
import { getGameShift, getTeamShift } from './schoolShifts.js'
import { getMatchState } from './match.js'
import { eventDate } from './tvSchedule.js'
import { buildStatisticsTeamAliases, statisticsTeamKey } from './athleteStatistics.js'

const key = (value) => normalizeFilterText(value).replace(/\b([1-9])[º°ªo]?\s*([ab])\b/g, '$1$2').trim()
export function buildGlobalSearchIndex({ games = [], teams = [], players = [], isMaster = false, isViewer = false }) {
  const teamMap = new Map(teams.map((team) => [team.id, team]))
  const resultView = isMaster ? 'admin' : isViewer ? 'calendario' : 'jogos'
  const entries = games.map((game) => ({
    key: `game:${game.id}`, kind: 'game', id: game.id, gameId: game.id,
    label: `${game.timeA} × ${game.timeB}`, detail: [game.esporteNome, game.venue, game.fase].filter(Boolean).join(' · '),
    search: key([game.timeA, game.timeB, game.esporteNome, game.venue, game.venueArea, game.fase, game.tournamentName].join(' ')),
    state: getMatchState(game), date: game.dataHora, sportId: game.sportId, shift: getGameShift(game),
    view: resultView, tab: 'jogos',
  }))
  for (const team of teams) entries.push({ key: `team:${team.id}`, kind: 'team', id: team.id, teamId: team.id, teamRecord: team, label: team.nome, detail: [team.esporteNome, team.categoria, 'Equipe'].filter(Boolean).join(' · '), search: key([team.nome, team.esporteNome, team.turma, team.categoria].join(' ')), sportId: team.sportId, shift: getTeamShift(team), searchText: team.nome, view: resultView, tab: 'times' })
  if (isMaster) for (const player of players) {
    const team = teamMap.get(player.teamId)
    if (!team) continue
    entries.push({ key: `player:${player.teamId}:${player.id}`, kind: 'player', id: player.id, playerId: player.id, teamId: player.teamId, label: String(player.nome || 'Atleta'), detail: `${team.nome} · ${team.esporteNome || 'Equipe'}`, search: key([player.nome, team.nome, team.esporteNome, player.posicao].join(' ')), sportId: team.sportId, shift: getTeamShift(team), view: 'admin', tab: 'jogadores' })
  }
  if (isViewer) {
    const seen = new Set(), aliases = buildStatisticsTeamAliases(games)
    for (const game of games) for (const player of game.scorerStats || []) {
      if (!player.playerId || !['A', 'B'].includes(player.side)) continue
      const teamKey = statisticsTeamKey(game, player.side, aliases)
      const id = `${teamKey}:${player.playerId}`
      if (seen.has(id)) continue
      seen.add(id)
      const label = String(player.playerName || 'Atleta').trim().split(/\s+/)[0]
      entries.push({ key: `public-player:${id}`, kind: 'player', id, label, detail: `${game[`time${player.side}`]} · ${game.esporteNome}`, search: key(`${label} ${game[`time${player.side}`]} ${game.esporteNome}`), searchText: label, statsTeamKey: teamKey, sportId: game.sportId, shift: getGameShift(game), view: 'estatisticas' })
    }
  }
  return entries
}

export function searchGlobalIndex(entries, query, limit = 30, now = new Date()) {
  const normalized = key(query), terms = normalized.split(/\s+/).filter(Boolean)
  return entries.filter((entry) => normalized ? terms.every((term) => entry.search.includes(term)) : entry.kind === 'game' && (entry.state === 'live' || entry.state === 'scheduled' && eventDate(entry.date).getTime() >= now.getTime()))
    .map((entry) => ({ entry, score: !normalized ? entry.state === 'live' ? 100 : eventDate(entry.date).getTime() >= now.getTime() ? 60 : 0 : key(entry.label) === normalized ? 100 : key(entry.label).startsWith(normalized) ? 80 : 20 }))
    .sort((a, b) => b.score - a.score || (a.entry.kind === 'game' && b.entry.kind === 'game' ? (eventDate(a.entry.date).getTime() || Infinity) - (eventDate(b.entry.date).getTime() || Infinity) : a.entry.label.localeCompare(b.entry.label, 'pt-BR')))
    .slice(0, limit).map(({ entry }) => entry)
}
