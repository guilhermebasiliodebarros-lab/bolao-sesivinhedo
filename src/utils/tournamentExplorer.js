import { normalizeFilterText } from './game.js'
import { getGameShift } from './schoolShifts.js'
import { getMatchCondition, getMatchOutcome, getMatchState, MATCH_STATE } from './match.js'
import { isKnockoutMatch } from './tieBreak.js'
import { buildInterclassStandings } from './interclassStandings.js'
import { getSportProfile, validateSportScores } from './sportRules.js'
import { sourceParticipant } from './thirdPlace.js'

export const competitionKey = (game) => JSON.stringify([game.sportId || game.esporteNome || 'geral', getGameShift(game), game.tournamentId || normalizeFilterText(game.tournamentName).trim() || 'sem-torneio'])

export function listCompetitions(games) {
  const competitions = new Map()
  for (const game of games) {
    const id = competitionKey(game)
    if (!competitions.has(id)) competitions.set(id, { id, sportId: game.sportId || game.esporteNome || 'geral', sportName: game.esporteNome || 'Modalidade', turno: getGameShift(game), name: game.tournamentName || (game.tournamentId ? 'Torneio sem nome' : 'Jogos sem torneio definido'), games: [] })
    competitions.get(id).games.push(game)
  }
  return [...competitions.values()].sort((a, b) => a.sportName.localeCompare(b.sportName, 'pt-BR') || a.turno.localeCompare(b.turno) || a.name.localeCompare(b.name, 'pt-BR'))
}

const roundRank = (game) => {
  const phase = normalizeFilterText(game.fase)
  return game.placement === 'third-place' ? 3 : /oitav/.test(phase) ? 0 : /quart/.test(phase) ? 1 : /semi/.test(phase) ? 2 : /\bfinal\b/.test(phase) ? 3 : 0
}
const roundOrder = (a, b) => String(a.rodada || a.id).localeCompare(String(b.rodada || b.id), 'pt-BR', { numeric: true })

export function buildBracket(games) {
  const nodes = games.filter(isKnockoutMatch).map((game) => ({ id: game.id, game, rank: roundRank(game) }))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const links = new Map()
  let missingLinks = 0
  const link = (sourceId, targetId, side) => {
    const source = byId.get(sourceId); const target = byId.get(targetId)
    if (!source || !target || source === target || competitionKey(source.game) !== competitionKey(target.game)) { missingLinks++; return }
    const key = `${targetId}:${side}`
    if (!links.has(key)) links.set(key, { source: sourceId, target: targetId, side })
  }
  for (const node of nodes) for (const side of ['A', 'B']) if (node.game[`sourceGameId${side}`]) link(node.game[`sourceGameId${side}`], node.id, side)
  for (const node of nodes) if (node.game.nextGameId && ['A', 'B'].includes(node.game.nextGameSlot)) link(node.id, node.game.nextGameId, node.game.nextGameSlot)
  const incoming = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of links.values()) incoming.set(edge.target, incoming.get(edge.target) + 1)
  const queue = nodes.filter((node) => incoming.get(node.id) === 0).sort((a, b) => roundOrder(a.game, b.game))
  const processed = new Set()
  while (queue.length) {
    const node = queue.shift(); processed.add(node.id)
    for (const edge of links.values()) if (edge.source === node.id) {
      const target = byId.get(edge.target)
      target.rank = Math.max(target.rank, node.rank + 1)
      incoming.set(target.id, incoming.get(target.id) - 1)
      if (!incoming.get(target.id)) queue.push(target)
    }
  }
  const cycle = processed.size !== nodes.length
  const edges = [...links.values()].filter((edge) => byId.get(edge.source).rank < byId.get(edge.target).rank && processed.has(edge.source) && processed.has(edge.target))
  const ranks = [...new Set(nodes.map((node) => node.rank))].sort((a, b) => a - b)
  const width = 260; const height = 206; const gap = 70; const verticalGap = 26
  const rounds = ranks.map((rank, column) => {
    const items = nodes.filter((node) => node.rank === rank).sort((a, b) => roundOrder(a.game, b.game))
    const desired = (node, index) => {
      const parents = edges.filter((edge) => edge.target === node.id).map((edge) => byId.get(edge.source)).filter((parent) => Number.isFinite(parent.y))
      return parents.length ? parents.reduce((sum, parent) => sum + parent.y, 0) / parents.length : 60 + index * (height + verticalGap)
    }
    items.forEach((node, index) => { node.desiredY = desired(node, index) })
    items.sort((a, b) => a.desiredY - b.desiredY || roundOrder(a.game, b.game))
    let bottom = 34
    items.forEach((node) => { node.x = 16 + column * (width + gap); node.y = Math.max(bottom + verticalGap, node.desiredY); bottom = node.y + height })
    const names = [...new Set(items.map((node) => node.game.fase || 'Eliminatórias'))]
    return { rank, x: 16 + column * (width + gap), label: names.length === 1 ? names[0] : items.some((node) => node.game.placement === 'third-place') ? 'Final e terceiro lugar' : `Rodada ${column + 1}`, nodes: items }
  })
  const finals = nodes.filter((node) => node.game.placement !== 'third-place' && /\bfinal\b/.test(normalizeFilterText(node.game.fase)) && !/semi|quarta|oitava/.test(normalizeFilterText(node.game.fase)))
  const outcome = finals.length === 1 ? getMatchOutcome(finals[0].game) : null
  const champion = ['A', 'B'].includes(outcome) ? finals[0].game[`time${outcome}`] : ''
  return { nodes, byId, edges, rounds, champion, cycle, missingLinks, width: ranks.length ? ranks.length * width + (ranks.length - 1) * gap + 32 : 0, height: nodes.length ? Math.max(...nodes.map((node) => node.y + height)) + 20 : 0 }
}

export function bracketParticipant(node, side, graph) {
  const game = node.game
  const recorded = game[`time${side}`] || ''
  const placeholder = /^(vencedor|perdedor|classificado|\d+\s*[oº°]?\s+grupo)/i.test(recorded)
  if (recorded && !game[`seedLabel${side}`] && !placeholder) return recorded
  const edge = graph.edges.find((item) => item.target === node.id && item.side === side)
  const source = edge && graph.byId.get(edge.source)?.game
  const participant = source && sourceParticipant(source, game[`sourceOutcome${side}`])
  if (participant) return participant.name
  return game[`seedLabel${side}`] || recorded || 'A definir'
}

export function bracketPath(graph, id) {
  if (!id || !graph.byId.has(id)) return new Set()
  const selected = new Set([id])
  // Traverse ancestors and descendants separately, so siblings do not join the path.
  for (const direction of ['up', 'down']) {
    const queue = [id]; const seen = new Set([id])
    while (queue.length) {
      const current = queue.shift()
      for (const edge of graph.edges) {
        const next = direction === 'up' && edge.target === current ? edge.source : direction === 'down' && edge.source === current ? edge.target : null
        if (next && !seen.has(next)) { seen.add(next); selected.add(next); queue.push(next) }
      }
    }
  }
  return selected
}

export const isStandingsGame = (game) => Boolean(!isKnockoutMatch(game) && (String(game.groupName || '').trim() || game.stageType === 'league'))
export const standingsGames = (games) => games.filter(isStandingsGame).map((game) => game.groupName ? game : { ...game, groupName: 'Classificação geral' })
export const canSimulateGame = (game) => Boolean(isStandingsGame(game) && ![MATCH_STATE.FINISHED, MATCH_STATE.CANCELLED].includes(getMatchState(game)) && getMatchCondition(game) !== 'walkover' && game.timeA && game.timeB && !game.seedLabelA && !game.seedLabelB)
export const simulationFingerprint = (game) => JSON.stringify([competitionKey(game), game.groupName || '', game.stageType || '', game.timeA, game.timeB, game.teamIdA, game.teamIdB, getMatchState(game), getMatchCondition(game), game.placarA, game.placarB, getSportProfile(game)])

export function simulateStandings(games, drafts = {}, teams = [], sports = []) {
  const issues = {}; const applied = new Set()
  const projected = games.map((game) => {
    const draft = drafts[game.id]
    if (!draft) return game
    if (draft.fingerprint !== simulationFingerprint(game) || !canSimulateGame(game)) { issues[game.id] = 'O jogo oficial foi alterado. Este cenário foi ignorado; preencha novamente se a partida ainda permitir simulação.'; return game }
    if (String(draft.a).trim() === '' && String(draft.b).trim() === '') return game
    try {
      const [a, b] = validateSportScores(game, draft.a, draft.b, { final: true })
      applied.add(game.id)
      return { ...game, status: 'finalizado', liveStatus: 'finished', matchCondition: 'normal', placarA: a, placarB: b, tieBreak: null, simulated: true }
    } catch (error) { issues[game.id] = error.message; return game }
  })
  const official = buildInterclassStandings(standingsGames(games), teams, sports)
  const tables = buildInterclassStandings(standingsGames(projected), teams, sports).map((table) => {
    const baseline = official.find((item) => item.id === table.id)
    return { ...table, rows: table.rows.map((row, index) => ({ ...row, movement: (baseline?.rows.findIndex((item) => item.id === row.id) ?? index) - index })) }
  })
  const remainingGames = games.filter((game) => canSimulateGame(game) && !applied.has(game.id))
  const remainingByTable = Object.fromEntries(tables.map((table) => [table.id, remainingGames.filter((game) => competitionKey(game) === table.competitionId && normalizeFilterText(game.groupName || 'Classificação geral').trim() === normalizeFilterText(table.groupName).trim()).length]))
  return { tables, official, issues, applied, remaining: remainingGames.length, remainingByTable }
}

export function qualificationAtCut(table, count) {
  const cut = Math.min(table.rows.length, Math.max(1, Number(count) || 1))
  const score = (row) => JSON.stringify([row.pontos, row.vitorias, row.saldo, row.pro])
  const boundary = table.rows[cut - 1]
  const tied = boundary && table.rows[cut] && score(boundary) === score(table.rows[cut])
  return table.rows.map((row, index) => tied && score(row) === score(boundary) ? 'tie' : index < cut ? 'inside' : 'outside')
}

export function indicatedQualifiers(games, groupName) {
  const positions = []
  for (const game of games.filter(isKnockoutMatch)) for (const side of ['A', 'B']) {
    const seed = game[`qualifierSeed${side}`] || game[`seedLabel${side}`] || ''
    const match = seed.match(/^(\d+)\s*[oº°ª]?\s+(.+)$/i)
    if (match && normalizeFilterText(match[2]).trim() === normalizeFilterText(groupName).trim()) positions.push(Number(match[1]))
  }
  return positions.length ? Math.max(...positions) : null
}
