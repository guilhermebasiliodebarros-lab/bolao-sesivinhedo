import { toDate } from './format.js'
import { normalizeFilterText } from './game.js'
import { getMatchState, MATCH_STATE } from './match.js'
import { scoreboardSport } from './scoreboard.js'

export function validScoreboardGameIds(value) {
  return Array.isArray(value) && value.length <= 2 && new Set(value).size === value.length
    && value.every((id) => typeof id === 'string' && id.trim() === id && id.length > 0 && !id.includes('/'))
}

export function normalizeScoreboardSelection(value = {}) {
  const safeIds = value.gameIds === undefined || validScoreboardGameIds(value.gameIds)
  const gameIds = safeIds ? [...(value.gameIds || [])] : []
  const revision = Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0
  if (!safeIds || value.mode === 'standby' || (value.mode === 'manual' && !gameIds.length)) {
    return { gameIds: [], revision, mode: 'standby' }
  }
  return {
    gameIds,
    revision,
    mode: value.mode === 'manual' ? 'manual' : 'automatic',
  }
}

const isLive = (game) => getMatchState(game) === MATCH_STATE.LIVE
const startTime = (game) => toDate(game.startedAt).getTime() || 0

function selectAutomaticGames(games) {
  const active = games.filter((game) => !game.deletionPending && game.timeA && game.timeB && !game.seedLabelA && !game.seedLabelB && isLive(game))
    .sort((a, b) => startTime(b) - startTime(a) || a.id.localeCompare(b.id))
    .map((game) => ({
      game,
      sport: scoreboardSport(game),
      fullScreen: /\b(futebol|futsal|soccer|handebol|handball)\b/.test(normalizeFilterText(game.esporteNome)),
    }))
  const current = active.find(({ sport, fullScreen }) => fullScreen || sport === 'basketball' || sport === 'volleyball')
  if (!current) return active.slice(0, 2).map(({ game }) => game)
  if (current.fullScreen) return [current.game]

  const basketball = active.find(({ sport }) => sport === 'basketball')
  const volleyball = active.find(({ sport }) => sport === 'volleyball')
  if (basketball && volleyball) return [basketball.game, volleyball.game]

  return active.filter(({ sport }) => sport === current.sport).slice(0, 2).map(({ game }) => game)
}

export function buildSelectedScoreboard(games, value = {}) {
  const selection = normalizeScoreboardSelection(value)
  const byId = new Map(games.map((game) => [game.id, game]))
  const selected = selection.gameIds.map((id) => byId.get(id)).filter((game) => game && !game.deletionPending
    && ![MATCH_STATE.POSTPONED, MATCH_STATE.CANCELLED].includes(getMatchState(game)))
  const automatic = selection.mode === 'automatic' ? selectAutomaticGames(games) : []
  // A selection saved before the modes were introduced can still preview a game between live matches.
  const visible = automatic.length ? automatic : selected
  const live = visible.filter(isLive)
  const kind = live.length ? 'live' : !visible.length ? 'empty' : visible.every((game) => getMatchState(game) === MATCH_STATE.FINISHED) ? 'results' : 'upcoming'
  const unavailable = selection.mode === 'manual' ? selection.gameIds.length - selected.length : 0
  return { kind, live, games: visible, unavailable, mode: selection.mode }
}
