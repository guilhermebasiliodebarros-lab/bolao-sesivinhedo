import { normalizeFilterText } from './game.js'

export const VEST_COLORS = ['Vermelho', 'Azul', 'Amarelo', 'Verde', 'Laranja', 'Rosa', 'Branco', 'Preto', 'Roxo']
export const SCORE_MODES = { goals: 'Gols', points: 'Pontos', sets: 'Sets', chess: 'Xadrez' }

export function getSportProfile(value = {}) {
  const name = normalizeFilterText(value.esporteNome || value.nome)
  const inferred = /volei|volley/.test(name) ? 'sets' : /xadrez|chess/.test(name) ? 'chess' : /fut|hand/.test(name) ? 'goals' : 'points'
  const scoringMode = Object.hasOwn(SCORE_MODES, value.scoringMode) ? value.scoringMode : inferred
  const validPoints = (input, fallback) => input !== '' && input != null && Number.isFinite(Number(input)) && Number(input) >= 0 ? Number(input) : fallback
  return {
    scoringMode,
    volleyballBestOf: [3, 5].includes(Number(value.volleyballBestOf)) ? Number(value.volleyballBestOf) : 3,
    winPoints: validPoints(value.winPoints, scoringMode === 'chess' ? 1 : 3),
    drawPoints: validPoints(value.drawPoints, scoringMode === 'chess' ? 0.5 : 1),
    lossPoints: validPoints(value.lossPoints, 0),
  }
}

export function scoreLabel(game) { return SCORE_MODES[getSportProfile(game).scoringMode] }
export function formatSportScore(value) { return value === 0.5 ? '½' : String(value ?? '–') }

export function validateSportScores(game, first, second, { final = false } = {}) {
  if (first == null || second == null || String(first).trim() === '' || String(second).trim() === '') throw new Error('Informe os dois placares.')
  const a = Number(String(first).replace(',', '.'))
  const b = Number(String(second).replace(',', '.'))
  const profile = getSportProfile(game)
  if (![a, b].every((score) => Number.isFinite(score) && score >= 0 && score <= 10000)) throw new Error('Informe placares válidos e maiores ou iguais a zero.')
  if (profile.scoringMode === 'chess') {
    const allowed = (a === 1 && b === 0) || (a === 0 && b === 1) || (a === 0.5 && b === 0.5) || (!final && a === 0 && b === 0)
    if (!allowed) throw new Error('No xadrez, escolha vitória (1 × 0), empate (½ × ½) ou derrota (0 × 1).')
  } else {
    if (![a, b].every(Number.isInteger)) throw new Error('Informe placares inteiros para esta modalidade.')
    if (profile.scoringMode === 'sets') {
      const target = Math.ceil(profile.volleyballBestOf / 2)
      if (a > target || b > target || (a === target && b === target)) throw new Error(`Esta partida é melhor de ${profile.volleyballBestOf} sets; a vitória exige ${target} sets.`)
      if (final && Math.max(a, b) !== target) throw new Error(`Para encerrar, uma equipe deve vencer ${target} sets.`)
    }
  }
  return [a, b]
}

export function normalizeSetScores(value = []) {
  if (!Array.isArray(value) || value.length > 5) throw new Error('Informe no máximo cinco parciais de sets.')
  return value.map((set) => {
    if (String(set.a ?? '').trim() === '' || String(set.b ?? '').trim() === '') throw new Error('Preencha os dois placares de cada parcial.')
    const a = Number(set.a)
    const b = Number(set.b)
    if (![a, b].every((score) => Number.isInteger(score) && score >= 0 && score <= 999)) throw new Error('As parciais devem ser números inteiros maiores ou iguais a zero.')
    return { a, b }
  })
}

export function validateFinalSets(game, a, b, sets) {
  if (getSportProfile(game).scoringMode !== 'sets' || !sets.length) return
  if (sets.some((set) => set.a === set.b) || sets.filter((set) => set.a > set.b).length !== a || sets.filter((set) => set.b > set.a).length !== b) {
    throw new Error('As parciais precisam corresponder ao placar final de sets, sem sets empatados.')
  }
}

export function normalizeMatchDetails(game) {
  const text = (name, limit = 80) => {
    const value = String(game[name] || '').trim()
    if (value.length > limit) throw new Error('Os dados de local, equipe ou colete estão muito longos.')
    return value
  }
  const durationMinutes = Number(game.durationMinutes || 30)
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) throw new Error('A duração prevista deve ser de 1 a 480 minutos.')
  return { venue: text('venue'), venueArea: text('venueArea'), vestA: text('vestA', 30), vestB: text('vestB', 30), durationMinutes, teamIdA: text('teamIdA', 128), teamIdB: text('teamIdB', 128), turmaA: text('turmaA'), turmaB: text('turmaB') }
}
