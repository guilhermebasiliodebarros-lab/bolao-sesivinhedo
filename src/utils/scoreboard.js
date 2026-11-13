import { normalizeFilterText } from './game.js'
import { getMatchState, MATCH_STATE } from './match.js'
import { getSportProfile } from './sportRules.js'

const firstName = (name) => String(name || '').trim().split(/\s+/)[0]
const minuteOf = (event) => event.elapsedMs != null && Number.isFinite(Number(event.elapsedMs)) && Number(event.elapsedMs) >= 0 ? Math.floor(Number(event.elapsedMs) / 60000) : null

export function scoreboardIncidents(game) {
  const rows = []
  const goalGame = getSportProfile(game).scoringMode === 'goals'
  if (goalGame && game.scorerStats?.length) {
    for (const scorer of game.scorerStats) {
      if (!['A', 'B'].includes(scorer.side) || !(scorer.total > 0)) continue
      const minutes = (scorer.minutes || []).filter((minute) => Number.isInteger(minute) && minute >= 0)
      rows.push({ id: `scorer-${scorer.side}-${scorer.playerId || scorer.playerName}`, kind: 'goal', side: scorer.side, player: firstName(scorer.playerName), minutes, total: scorer.total, minute: minutes[0] ?? null })
    }
  } else {
    for (const event of game.liveEvents || []) {
      if (!['A', 'B'].includes(event.side) || !['goal', 'point'].includes(event.kind)) continue
      rows.push({ id: event.id, kind: event.kind, side: event.side, player: firstName(event.playerName), minute: minuteOf(event), value: event.value })
    }
  }
  for (const card of game.publicCardEvents || []) {
    if (!['A', 'B'].includes(card.side) || !['yellow', 'red'].includes(card.kind)) continue
    rows.push({ id: card.id, kind: card.kind, side: card.side, player: firstName(card.playerName), minute: minuteOf(card) })
  }
  return rows.sort((a, b) => (a.minute ?? Infinity) - (b.minute ?? Infinity) || a.id.localeCompare(b.id))
}

export function scoreboardSport(game) {
  const name = normalizeFilterText(game.esporteNome)
  if (/basquet|basket/.test(name)) return 'basketball'
  if (/volei|volley/.test(name)) return 'volleyball'
  if (/fut|soccer/.test(name)) return 'football'
  if (/hand/.test(name)) return 'handball'
  return 'other'
}

export function recentScoreEvent(game, now = new Date()) {
  if (getMatchState(game) !== MATCH_STATE.LIVE) return null
  const event = [...(game.liveEvents || []), ...(game.publicCardEvents || [])]
    .filter((item) => ['goal', 'point', 'set', 'yellow', 'red'].includes(item.kind) && ['A', 'B'].includes(item.side))
    .sort((a, b) => Number(a.recordedAt) - Number(b.recordedAt)).at(-1)
  const age = now.getTime() - Number(event?.recordedAt)
  if (!event || !Number.isFinite(age) || age < -5000 || age > 8000 || !['A', 'B'].includes(event.side)) return null
  const label = event.correctionRevision ? 'Lance corrigido' : event.kind === 'goal' ? 'Gol!'
    : event.kind === 'yellow' ? 'Cartão amarelo' : event.kind === 'red' ? 'Cartão vermelho'
      : event.kind === 'set' ? 'Set conquistado!' : scoreboardSport(game) === 'basketball' ? `Cesta de ${event.value}!` : 'Ponto!'
  return { id: event.id, side: event.side, kind: event.kind, minute: minuteOf(event), label, team: game[`time${event.side}`], player: firstName(event.playerName) }
}
