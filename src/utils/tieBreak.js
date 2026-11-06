import { getSportProfile } from './sportRules.js'

export const TIE_BREAK_METHODS = { penalties: 'Pênaltis', 'extra-time': 'Prorrogação' }
export function isKnockoutMatch(game = {}) {
  if (game.stageType === 'group') return false
  if (game.stageType === 'knockout' || game.sourceGameIdA || game.sourceGameIdB) return true
  const phase = String(game.fase || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return /\b(final|semifinais?|quartas|oitavas|mata.?mata)\b/.test(phase)
}
export function canUseTieBreak(game) { return isKnockoutMatch(game) && ['goals', 'points'].includes(getSportProfile(game).scoringMode) }
export function normalizeTieBreak(game, value, a, b, { final = false } = {}) {
  if (!canUseTieBreak(game) || Number(a) !== Number(b)) return null
  if (!value?.method || value.method === 'none') {
    if (final) throw new Error('O mata-mata terminou empatado. Informe o desempate antes de encerrar.')
    return null
  }
  if (!Object.hasOwn(TIE_BREAK_METHODS, value.method) || (value.method === 'penalties' && getSportProfile(game).scoringMode !== 'goals')) throw new Error('Escolha um método de desempate válido para esta modalidade.')
  if ([value.scoreA, value.scoreB].some((score) => score == null || String(score).trim() === '')) throw new Error('Informe os dois placares do desempate.')
  const scores = [Number(value.scoreA), Number(value.scoreB)]
  if (!scores.every((score) => Number.isInteger(score) && score >= 0 && score <= 10000)) throw new Error('Informe placares inteiros e positivos ou zero no desempate.')
  if (final && scores[0] === scores[1]) throw new Error('O desempate precisa indicar uma equipe vencedora.')
  return { method: value.method, scoreA: scores[0], scoreB: scores[1] }
}
export function tieBreakSummary(game) {
  const tie = game?.tieBreak
  if (!tie || !Object.hasOwn(TIE_BREAK_METHODS, tie.method)) return ''
  return `${TIE_BREAK_METHODS[tie.method]}: ${tie.scoreA} × ${tie.scoreB}`
}
