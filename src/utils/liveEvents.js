import { getSportProfile } from './sportRules.js'
import { normalizeFilterText } from './game.js'
import { matchClockValue } from './matchClock.js'
import { getMatchCondition, getMatchState, MATCH_STATE } from './match.js'

export const scoreRevision = (game) => Number(game.scoreRevision) || 0
export const isBasketball = (game) => /basquet|basket/.test(normalizeFilterText(game.esporteNome))
export const eventIcon = (event) => event.kind === 'goal' ? '⚽' : event.kind === 'set' ? '✓' : '●'
export const eventMinute = (event) => `${Math.floor((Number(event.elapsedMs) || 0) / 60000)}′`
export const currentSetScore = (game) => ({ a: Number(game.currentSet?.a) || 0, b: Number(game.currentSet?.b) || 0, number: (Number(game.liveScoreA) || 0) + (Number(game.liveScoreB) || 0) + 1 })
export function scoringSnapshot(game) {
  return { liveScoreA: Number(game.liveScoreA) || 0, liveScoreB: Number(game.liveScoreB) || 0, setScores: game.setScores || [], currentSet: game.currentSet || null, liveEvents: game.liveEvents || [], scorerStats: game.scorerStats || [], lastScoreEventId: game.lastScoreEventId || null }
}

export function applyLiveEvent(game, input, { player = null, now, elapsedMs }) {
  const profile = getSportProfile(game)
  if (profile.scoringMode === 'chess') throw new Error('Use o resultado da partida para atualizar o xadrez.')
  const before = scoringSnapshot(game)
  const after = structuredClone(before)
  const target = Math.ceil(profile.volleyballBestOf / 2)
  if (profile.scoringMode === 'sets' && Math.max(before.liveScoreA, before.liveScoreB) >= target) throw new Error('O placar de sets já indica um vencedor. Confira e encerre a partida.')
  if (!['A', 'B'].includes(input.side) && input.kind !== 'set') throw new Error('Selecione a equipe do lance.')
  const kind = input.kind === 'set' ? 'set' : profile.scoringMode === 'goals' ? 'goal' : 'point'
  const event = { id: input.requestId, kind, side: input.side || '', value: Number(input.value ?? 1), playerName: '', playerId: '', elapsedMs: elapsedMs ?? matchClockValue(game, now).elapsedMs, recordedAt: now.getTime(), setNumber: profile.scoringMode === 'sets' ? currentSetScore(game).number : null }
  if (kind === 'set') {
    if (profile.scoringMode !== 'sets') throw new Error('Esta modalidade não usa sets.')
    const set = currentSetScore(game)
    if (set.a === set.b) throw new Error('O set precisa ter uma equipe vencedora. Confira os pontos antes de encerrar.')
    event.side = set.a > set.b ? 'A' : 'B'; event.value = 1; event.setScore = { a: set.a, b: set.b }
    if (after.setScores.length !== before.liveScoreA + before.liveScoreB) throw new Error('Confira as parciais dos sets anteriores em Correção manual antes de encerrar este set.')
    after.setScores.push(event.setScore)
    after[`liveScore${event.side}`] += 1
    after.currentSet = { a: 0, b: 0 }
  } else {
    const allowed = isBasketball(game) && profile.scoringMode === 'points' ? [1, 2, 3] : [1]
    if (!allowed.includes(event.value)) throw new Error('Quantidade de pontos inválida para esta modalidade.')
    if (player) {
      event.playerName = String(player.nome).trim().split(/\s+/)[0]
      event.playerId = player.id
    }
    if (profile.scoringMode === 'sets') {
      const set = currentSetScore(game)
      const key = input.side.toLowerCase()
      if (set[key] >= 999) throw new Error('Confira o placar do set antes de continuar.')
      after.currentSet = { a: set.a, b: set.b, [key]: set[key] + event.value }
    } else {
      if (after[`liveScore${input.side}`] + event.value > 10000) throw new Error('Confira o placar antes de continuar.')
      after[`liveScore${input.side}`] += event.value
    }
    if (player) {
      const index = after.scorerStats.findIndex((item) => item.side === input.side && item.playerId === player.id)
      const previous = index < 0 ? { side: input.side, playerId: player.id, playerName: event.playerName, total: 0, minutes: [] } : after.scorerStats[index]
      const stat = { ...previous, playerName: event.playerName, total: previous.total + event.value, minutes: [...previous.minutes, Math.floor(event.elapsedMs / 60000)].slice(-8) }
      if (index < 0) after.scorerStats.push(stat); else after.scorerStats[index] = stat
    }
  }
  event.scoreAfter = { a: after.liveScoreA, b: after.liveScoreB, currentSet: after.currentSet }
  after.liveEvents = [...after.liveEvents, event].slice(-8)
  after.lastScoreEventId = input.requestId
  return { before, after, event }
}

export function canCorrectLiveEvent(game, event) {
  if (!event || game.deletionPending || getMatchState(game) !== MATCH_STATE.LIVE || getMatchCondition(game) !== 'normal' || !['goal', 'point'].includes(event.kind)) return false
  const profile = getSportProfile(game)
  if (profile.scoringMode === 'chess') return false
  return profile.scoringMode !== 'sets' || (event.setNumber === currentSetScore(game).number && Math.max(game.liveScoreA || 0, game.liveScoreB || 0) < Math.ceil(profile.volleyballBestOf / 2))
}

// Replay the active suffix from the checkpoint before the corrected event. This preserves later
// scorers, minutes and undo checkpoints instead of clearing all individual statistics.
export function rebuildLiveEvents(game, records, { action, player = null }) {
  let state = { ...game, ...structuredClone(records[0].before) }
  const changes = []
  for (const [index, record] of records.entries()) {
    const original = record.event
    if (index === 0 && action === 'remove') continue
    const moved = index === 0 && action === 'transfer'
    const author = moved ? player : original.playerId ? { id: original.playerId, nome: original.playerName } : null
    const result = applyLiveEvent(state, {
      requestId: original.id, side: moved ? original.side === 'A' ? 'B' : 'A' : original.side,
      value: original.value, kind: original.kind === 'set' ? 'set' : 'score',
    }, { player: author, now: new Date(original.recordedAt), elapsedMs: original.elapsedMs })
    const event = { ...original, ...result.event, ...(moved ? { correctionRevision: (original.correctionRevision || 0) + 1 } : {}) }
    result.after.liveEvents[result.after.liveEvents.length - 1] = event
    changes.push({ id: original.id, before: result.before, event, previousEventId: result.before.lastScoreEventId })
    state = { ...state, ...result.after }
  }
  return { after: scoringSnapshot(state), changes }
}
