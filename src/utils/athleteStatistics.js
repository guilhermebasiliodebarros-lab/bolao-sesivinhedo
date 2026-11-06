import { getMatchCondition, getMatchState, MATCH_STATE } from './match.js'
import { getSportProfile } from './sportRules.js'
import { normalizeFilterText } from './game.js'

const key = (value) => normalizeFilterText(value).trim()
export const statisticsSportKey = (game) => game.sportId || key(game.esporteNome) || 'geral'
export const statisticsTournamentKey = (game) => JSON.stringify([statisticsSportKey(game), game.tournamentId || key(game.tournamentName) || 'sem-torneio'])
export const statisticsTeamKey = (game, side, aliases = new Map()) => JSON.stringify([statisticsSportKey(game), game[`teamId${side}`] || aliases.get(JSON.stringify([statisticsSportKey(game), key(game[`time${side}`])])) || key(game[`time${side}`])])
export const hasIndividualScoring = (game) => getSportProfile(game).scoringMode !== 'chess'

export function buildStatisticsTeamAliases(games) {
  const ids = new Map()
  games.forEach((game) => ['A', 'B'].forEach((side) => {
    if (!game[`teamId${side}`] || !game[`time${side}`] || game[`seedLabel${side}`]) return
    const name = JSON.stringify([statisticsSportKey(game), key(game[`time${side}`])])
    if (!ids.has(name)) ids.set(name, new Set())
    ids.get(name).add(game[`teamId${side}`])
  }))
  return new Map([...ids].filter(([, values]) => values.size === 1).map(([name, values]) => [name, [...values][0]]))
}

export function buildAthleteStatistics(games, { sport = '', tournament = '', team = '', finishedOnly = false, search = '' } = {}) {
  const groups = new Map()
  const aliases = buildStatisticsTeamAliases(games)
  const query = key(search)
  games.forEach((game) => {
    const state = getMatchState(game)
    if (!hasIndividualScoring(game) || getMatchCondition(game) !== 'normal' || ![MATCH_STATE.LIVE, MATCH_STATE.FINISHED].includes(state) || (finishedOnly && state !== MATCH_STATE.FINISHED)) return
    if ((sport && statisticsSportKey(game) !== sport) || (tournament && statisticsTournamentKey(game) !== tournament)) return
    const profile = getSportProfile(game)
    const groupId = JSON.stringify([statisticsSportKey(game), profile.scoringMode])
    const group = groups.get(groupId) || { id: groupId, sportId: statisticsSportKey(game), sportName: game.esporteNome || 'Modalidade', scoringMode: profile.scoringMode, unit: profile.scoringMode === 'goals' ? 'Gols' : 'Pontos', players: new Map(), gameIds: new Set(), adjustedGameIds: new Set() }
    const seen = new Set()
    ;(game.scorerStats || []).forEach((stat) => {
      if (!['A', 'B'].includes(stat.side) || !stat.playerId || !String(stat.playerName || '').trim() || !Number.isInteger(stat.total) || stat.total <= 0) return
      if (game[`seedLabel${stat.side}`]) return
      const teamId = statisticsTeamKey(game, stat.side, aliases)
      if (team && teamId !== team) return
      const name = String(stat.playerName).trim().split(/\s+/)[0]
      const teamName = game[`time${stat.side}`] || 'Equipe a definir'
      const id = JSON.stringify([teamId, stat.playerId])
      if (seen.has(id)) return
      seen.add(id)
      const row = group.players.get(id) || { id, playerId: stat.playerId, name, teamId, teamName, total: 0, liveTotal: 0, games: new Set() }
      row.total += stat.total
      if (state === MATCH_STATE.LIVE) row.liveTotal += stat.total
      row.games.add(game.id)
      group.players.set(id, row)
    })
    if (team && !['A', 'B'].some((side) => statisticsTeamKey(game, side, aliases) === team)) return
    group.gameIds.add(game.id)
    if (game.eventsAdjusted) group.adjustedGameIds.add(game.id)
    groups.set(groupId, group)
  })
  return [...groups.values()].map(({ players, gameIds, adjustedGameIds, ...group }) => {
    const ranked = [...players.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR') || a.teamName.localeCompare(b.teamName, 'pt-BR') || a.id.localeCompare(b.id))
    let rank = 0
    const rows = ranked.map((row, index) => {
      if (!index || row.total !== ranked[index - 1].total) rank = index + 1
      return { ...row, games: row.games.size, rank }
    })
    return { ...group, games: gameIds.size, adjustedGames: adjustedGameIds.size, recordedTotal: rows.reduce((sum, row) => sum + row.total, 0), athletes: rows.length,
      rows: rows.filter((row) => !query || [row.name, row.teamName].some((value) => key(value).includes(query))) }
  }).sort((a, b) => a.sportName.localeCompare(b.sportName, 'pt-BR') || a.scoringMode.localeCompare(b.scoringMode))
}
