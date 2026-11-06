import { getSportProfile } from './sportRules.js'
import { normalizeFilterText } from './game.js'
import { getMatchOutcome } from './match.js'

export function buildInterclassStandings(games, teams = [], sports = []) {
  const tables = new Map()
  const sportById = new Map(sports.map((sport) => [sport.id, sport]))
  const key = (name) => normalizeFilterText(name).trim()
  games.forEach((game) => {
    const groupName = String(game.groupName || '').trim()
    if (!groupName || game.stageType === 'knockout') return
    const sportId = game.sportId || game.esporteNome || 'geral'
    const tournamentKey = game.tournamentId || key(game.tournamentName) || 'sem-torneio'
    const competitionId = JSON.stringify([sportId, tournamentKey])
    const id = JSON.stringify([sportId, tournamentKey, key(groupName)])
    if (!tables.has(id)) tables.set(id, {
      id, competitionId, sportId, sportName: game.esporteNome || sportById.get(sportId)?.nome || 'Esporte',
      tournamentId: game.tournamentId || '', tournamentName: game.tournamentName || 'Torneio sem nome', groupName,
      ...getSportProfile({ ...sportById.get(sportId), ...game }), entries: new Map(),
    })
    const table = tables.get(id)
    const ensureRow = (side) => {
      const name = game[`time${side}`]
      if (!name || game[`seedLabel${side}`]) return null
      const team = teams.find((item) => item.id === game[`teamId${side}`])
        || teams.find((item) => item.sportId === game.sportId && item.nome === name)
      const rowId = team?.id || key(name)
      if (!table.entries.has(rowId)) table.entries.set(rowId, {
        id: rowId, nome: name, turma: team?.turma || game[`turma${side}`] || '',
        pontos: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, pro: 0, contra: 0, saldo: 0,
      })
      return table.entries.get(rowId)
    }
    const a = ensureRow('A')
    const b = ensureRow('B')
    const outcome = getMatchOutcome(game)
    if (!a || !b || a === b || !outcome) return
    const profile = getSportProfile({ ...sportById.get(sportId), ...game })
    a.jogos += 1; b.jogos += 1
    if (Number.isFinite(game.placarA) && Number.isFinite(game.placarB)) {
      a.pro += game.placarA; a.contra += game.placarB
      b.pro += game.placarB; b.contra += game.placarA
    }
    if (outcome === 'draw') { a.empates += 1; b.empates += 1; a.pontos += profile.drawPoints; b.pontos += profile.drawPoints }
    else {
      const winner = outcome === 'A' ? a : b
      const loser = winner === a ? b : a
      winner.vitorias += 1; winner.pontos += profile.winPoints
      loser.derrotas += 1; loser.pontos += profile.lossPoints
    }
    a.saldo = a.pro - a.contra; b.saldo = b.pro - b.contra
  })
  return [...tables.values()].map(({ entries, ...table }) => ({ ...table, rows: [...entries.values()].sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || b.saldo - a.saldo || b.pro - a.pro || a.nome.localeCompare(b.nome, 'pt-BR')) }))
    .sort((a, b) => a.sportName.localeCompare(b.sportName, 'pt-BR') || a.tournamentName.localeCompare(b.tournamentName, 'pt-BR') || a.competitionId.localeCompare(b.competitionId) || a.groupName.localeCompare(b.groupName, 'pt-BR', { numeric: true }))
}
