import { getMatchState, MATCH_STATE } from './match.js'

export function validScoreboardGameIds(value) {
  return Array.isArray(value) && value.length <= 2 && new Set(value).size === value.length
    && value.every((id) => typeof id === 'string' && id.trim() === id && id.length > 0 && !id.includes('/'))
}

export function normalizeScoreboardSelection(value = {}) {
  return {
    gameIds: validScoreboardGameIds(value.gameIds) ? [...value.gameIds] : [],
    revision: Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
  }
}

export function buildSelectedScoreboard(games, value = {}) {
  const selection = normalizeScoreboardSelection(value)
  const byId = new Map(games.map((game) => [game.id, game]))
  const selected = selection.gameIds.map((id) => byId.get(id)).filter((game) => game && !game.deletionPending
    && ![MATCH_STATE.POSTPONED, MATCH_STATE.CANCELLED].includes(getMatchState(game)))
  const live = selected.filter((game) => getMatchState(game) === MATCH_STATE.LIVE)
  const results = selected.filter((game) => getMatchState(game) === MATCH_STATE.FINISHED)
  const kind = live.length ? 'live' : !selected.length ? 'empty' : results.length === selected.length ? 'results' : 'upcoming'
  return { kind, live, games: selected, unavailable: selection.gameIds.length - selected.length }
}
