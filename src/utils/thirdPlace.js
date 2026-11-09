import { getMatchOutcome } from './match.js'
import { normalizeFilterText } from './game.js'
import { getGameShift } from './schoolShifts.js'

export function sourceParticipant(game, sourceOutcome = 'winner') {
  const outcome = getMatchOutcome(game)
  if (!['A', 'B'].includes(outcome)) return null
  const side = sourceOutcome === 'loser' ? (outcome === 'A' ? 'B' : 'A') : outcome
  return { name: game[`time${side}`], teamId: game[`teamId${side}`] || '', turma: game[`turma${side}`] || '' }
}

export function thirdPlaceSemifinals(games) {
  const semis = games.filter((game) => /^semifina/.test(normalizeFilterText(game.fase))).sort((a, b) => String(a.rodada || a.id).localeCompare(String(b.rodada || b.id), 'pt-BR', { numeric: true }))
  if (semis.length !== 2 || games.some((game) => game.placement === 'third-place' || /3[ºo°]?\s*lugar|terceiro/.test(normalizeFilterText(game.fase)))) return []
  if (semis[0].sportId !== semis[1].sportId || !semis[0].tournamentId || semis[0].tournamentId !== semis[1].tournamentId || getGameShift(semis[0]) !== getGameShift(semis[1])) return []
  return semis
}

export function thirdPlaceParticipants(semis) {
  if (semis.length !== 2) throw new Error('Selecione um torneio com duas semifinais.')
  const fields = { placement: 'third-place', stageType: 'knockout', fase: 'Disputa de 3º lugar', rodada: 'Terceiro lugar' }
  semis.forEach((game, index) => {
    const side = index ? 'B' : 'A'
    const participant = sourceParticipant(game, 'loser')
    const label = `Perdedor ${game.rodada || `Semifinal ${index + 1}`}`
    Object.assign(fields, { [`sourceGameId${side}`]: game.id, [`sourceOutcome${side}`]: 'loser', [`time${side}`]: participant?.name || label, [`teamId${side}`]: participant?.teamId || '', [`turma${side}`]: participant?.turma || '', [`seedLabel${side}`]: participant ? '' : label })
  })
  return fields
}
