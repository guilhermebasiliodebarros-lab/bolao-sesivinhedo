import { normalizeFilterText } from './game.js'
import { getMatchState, MATCH_STATE } from './match.js'
import { getSportProfile } from './sportRules.js'

const firstName = (name) => String(name || '').trim().split(/\s+/)[0]
const minuteOf = (event) => event.elapsedMs != null && Number.isFinite(Number(event.elapsedMs)) && Number(event.elapsedMs) >= 0 ? Math.floor(Number(event.elapsedMs) / 60000) : null
const sides = ['A', 'B']

export function scoreboardIncidents(game) {
  const kind = getSportProfile(game).scoringMode === 'goals' ? 'goal' : 'point'
  const totals = new Map()
  const registeredNames = new Set()
  for (const scorer of game.scorerStats || []) {
    if (!sides.includes(scorer.side) || !Number.isInteger(scorer.total) || scorer.total < 1) continue
    const player = firstName(scorer.playerName)
    const id = `scorer-${scorer.side}-${scorer.playerId || scorer.playerName}`
    const minutes = kind === 'goal' ? (scorer.minutes || []).filter((minute) => Number.isInteger(minute) && minute >= 0).sort((a, b) => a - b) : []
    const row = { id, kind, side: scorer.side, player, total: scorer.total, minute: minutes[0] ?? null }
    if (kind === 'goal') row.minutes = minutes
    totals.set(id, row)
    if (player) registeredNames.add(JSON.stringify([scorer.side, player]))
  }

  // Older records may only have recent events. Sum those without adding them again to an existing total.
  const history = new Map()
  for (const event of game.liveEvents || []) {
    if (!sides.includes(event.side) || event.kind !== kind) continue
    const player = firstName(event.playerName)
    const id = `scorer-${event.side}-${event.playerId || event.playerName || 'team'}`
    if (totals.has(id) || (!event.playerId && registeredNames.has(JSON.stringify([event.side, player])))) continue
    const value = kind === 'goal' ? 1 : Number(event.value)
    if (!Number.isInteger(value) || value < 1) continue
    const row = history.get(id) || { id, kind, side: event.side, player, total: 0, minute: null }
    row.total += value
    if (kind === 'goal') {
      const minute = minuteOf(event)
      row.minutes ||= []
      if (minute !== null) row.minutes.push(minute)
    }
    history.set(id, row)
  }
  for (const row of history.values()) {
    row.minutes?.sort((a, b) => a - b)
    row.minute = row.minutes?.[0] ?? null
  }

  const rows = [...totals.values(), ...history.values()]
  for (const card of game.publicCardEvents || []) {
    if (!sides.includes(card.side) || !['yellow', 'red'].includes(card.kind)) continue
    rows.push({ id: card.id, kind: card.kind, side: card.side, player: firstName(card.playerName), minute: minuteOf(card) })
  }
  return rows.sort((a, b) => (a.minute ?? Infinity) - (b.minute ?? Infinity) || (b.total || 0) - (a.total || 0) || a.id.localeCompare(b.id))
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
