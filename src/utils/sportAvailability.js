import { normalizeFilterText } from './game.js'

// Modalidades participantes do Interclasse, por turno.
const sportShifts = new Map([['rpg', []], ['fifa', []], ['mancala', ['manha']]])

export function isSportAvailable(sport, turno = '') {
  const name = typeof sport === 'string' ? sport : sport?.esporteNome || sport?.nome || sport?.name || ''
  const shifts = sportShifts.get(normalizeFilterText(name).trim())
  return !shifts || (turno ? shifts.includes(turno) : shifts.length > 0)
}
