import { eventDate } from './tvSchedule.js'
import { getMatchState, MATCH_STATE } from './match.js'

export const clockRevision = (game) => Number.isSafeInteger(game.clock?.revision) ? game.clock.revision : 0
export function matchClockValue(game, now) {
  const stored = game.clock
  const elapsed = Number.isFinite(stored?.elapsedMs) ? Math.max(0, stored.elapsedMs) : 0
  const since = eventDate(stored ? stored.runningSince : game.startedAt).getTime()
  const running = getMatchState(game) === MATCH_STATE.LIVE && Number.isFinite(since)
  const elapsedMs = Math.floor(elapsed + (running ? Math.max(0, now.getTime() - since) : 0))
  return { elapsedMs, running, exceeded: elapsedMs >= (Number(game.durationMinutes) || 30) * 60000 }
}
export function stoppedMatchClock(game, now) {
  return { elapsedMs: matchClockValue(game, now).elapsedMs, runningSince: null, revision: clockRevision(game) + 1 }
}
export function formatMatchClock(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
