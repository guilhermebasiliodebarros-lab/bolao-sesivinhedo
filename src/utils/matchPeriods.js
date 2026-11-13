import { normalizeFilterText } from './game.js'
import { getMatchCondition, getMatchState, MATCH_STATE } from './match.js'
import { matchClockValue } from './matchClock.js'
import { getSportProfile } from './sportRules.js'

export const PERIOD_FORMATS = { single: 'Tempo único', halves: '2 tempos', quarters: '4 períodos' }
const totals = { single: 1, halves: 2, quarters: 4 }
export const periodRevision = (game) => Number.isSafeInteger(game.period?.revision) ? game.period.revision : 0
export const periodLabel = (number, format) => format === 'single' ? 'Tempo único' : `${number}º ${format === 'halves' ? 'tempo' : 'período'}`

export function matchPeriod(game, now = new Date()) {
  const profile = getSportProfile(game)
  const clock = matchClockValue(game, now)
  const basketball = /basquet|basket/.test(normalizeFilterText(game.esporteNome))
  const supported = profile.scoringMode === 'goals' || basketball
  const fallback = basketball ? 'quarters' : 'halves'
  const format = Object.hasOwn(PERIOD_FORMATS, game.period?.format) ? game.period.format : fallback
  const total = totals[format]
  const number = Number.isInteger(game.period?.number) ? Math.min(total, Math.max(1, game.period.number)) : 1
  const interval = supported && game.period?.phase === 'interval'
  const start = Number.isFinite(game.period?.startedElapsedMs) ? Math.max(0, game.period.startedElapsedMs) : 0
  const elapsedMs = Math.max(0, clock.elapsedMs - start)
  const durationMs = (Number(game.durationMinutes) || 30) * 60000 / total
  let label = supported ? interval ? `Intervalo · ${periodLabel(number, format)}` : periodLabel(number, format) : ''
  if (profile.scoringMode === 'sets') {
    const a = Number(game.liveScoreA) || 0, b = Number(game.liveScoreB) || 0
    label = Math.max(a, b) >= Math.ceil(profile.volleyballBestOf / 2) ? 'Sets encerrados' : `${a + b + 1}º set`
  }
  return { supported, format, total, number, interval, label, revision: periodRevision(game), elapsedMs, totalElapsedMs: clock.elapsedMs, durationMs, exceeded: supported ? elapsedMs >= durationMs : clock.exceeded }
}

export function planPeriodChange(game, { action, format }, now = new Date()) {
  if (getMatchState(game) !== MATCH_STATE.LIVE || getMatchCondition(game) !== 'normal' || game.deletionPending) throw new Error('Controle os períodos somente em uma partida ao vivo disponível.')
  const current = matchPeriod(game, now)
  if (!current.supported) throw new Error('Esta modalidade não usa o controle de tempos ou períodos. No vôlei, use os sets.')
  const period = { format: current.format, number: current.number, phase: current.interval ? 'interval' : 'playing', startedElapsedMs: game.period?.startedElapsedMs || 0, revision: current.revision + 1 }
  if (action === 'format') {
    if (!Object.hasOwn(PERIOD_FORMATS, format)) throw new Error('Selecione um formato de períodos válido.')
    if (current.number !== 1 || current.interval) throw new Error('Defina o formato antes de encerrar o primeiro tempo ou período.')
    return { period: { ...period, format }, clockAction: null }
  }
  if (action === 'interval') {
    if (current.interval || current.number >= current.total) throw new Error('Este período não pode entrar em intervalo. Confira a situação atual.')
    return { period: { ...period, phase: 'interval' }, clockAction: 'pause' }
  }
  if (action === 'next') {
    if (!current.interval || current.number >= current.total) throw new Error('Inicie o próximo período somente durante o intervalo.')
    return { period: { ...period, number: current.number + 1, phase: 'playing', startedElapsedMs: current.totalElapsedMs }, clockAction: 'resume' }
  }
  throw new Error('Escolha alterar o formato, iniciar intervalo ou iniciar o próximo período.')
}
