import { normalizeFilterText } from './game.js'
import { getMatchState, MATCH_STATE } from './match.js'
import { eventDate, schoolDay } from './tvSchedule.js'
import { venueKey } from './matchVenue.js'
import { getGameShift } from './schoolShifts.js'

const teamName = (team) => typeof team === 'string' ? team : team?.nome || ''
const key = (value) => normalizeFilterText(teamName(value)).trim()
const pairKey = (a, b) => JSON.stringify([key(a), key(b)].sort())
const millis = (value) => { const time = eventDate(value).getTime(); return Number.isFinite(time) ? time : null }

export function roundRobinRounds(teams) {
  if (teams.length < 2) return []
  const entries = [...teams]
  if (entries.length % 2) entries.push(null)
  // First round pairs the original neighbours; rotate the remaining positions.
  let ring = [...entries.filter((_, index) => index % 2 === 0), ...entries.filter((_, index) => index % 2).reverse()]
  const rounds = []
  for (let round = 0; round < entries.length - 1; round += 1) {
    const pairs = []
    for (let index = 0; index < ring.length / 2; index += 1) {
      const a = ring[index], b = ring[ring.length - 1 - index]
      if (a != null && b != null) pairs.push({ timeA: a, timeB: b })
    }
    rounds.push(pairs)
    ring = [ring[0], ...ring.slice(2), ring[1]]
  }
  return rounds
}

export function orderRoundRobinGames(games) {
  const groups = new Map()
  games.forEach((game) => {
    const groupKey = JSON.stringify([game.sportId || game.esporteNome || '', game.tournamentId || '', getGameShift(game), game.groupName || ''])
    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey).push(game)
  })
  const plans = [...groups.values()].map((matches) => {
    const teams = [...new Map(matches.flatMap((game) => [game.timeA, game.timeB]).filter(Boolean).map((name) => [key(name), name])).values()]
    const byPair = new Map()
    matches.forEach((game) => { const id = pairKey(game.timeA, game.timeB); if (!byPair.has(id)) byPair.set(id, []); byPair.get(id).push(game) })
    const rounds = roundRobinRounds(teams).map((round) => round.flatMap((pair) => { const game = byPair.get(pairKey(pair.timeA, pair.timeB))?.shift(); return game ? [game] : [] }))
    const remaining = [...byPair.values()].flat()
    if (remaining.length) rounds.push(remaining)
    return rounds
  })
  const result = []
  for (let round = 0; round < Math.max(0, ...plans.map((plan) => plan.length)); round += 1) plans.forEach((plan) => result.push(...(plan[round] || [])))
  return result
}

export function scheduleRestSummary(games) {
  const last = new Map()
  let consecutive = 0, minimumGap = Infinity
  let previousDay = ''
  games.forEach((game, index) => {
    const day = schoolDay(game.dataHora)
    if (day && previousDay && day !== previousDay) last.clear()
    if (day) previousDay = day
    let repeated = false
    ;[game.timeA, game.timeB].forEach((name) => {
      const id = key(name)
      if (!id) return
      if (last.has(id)) { const gap = index - last.get(id) - 1; minimumGap = Math.min(minimumGap, gap); if (!gap) repeated = true }
      last.set(id, index)
    })
    if (repeated) consecutive += 1
  })
  return { consecutive, minimumGap: Number.isFinite(minimumGap) ? minimumGap : null }
}

export const scheduleFingerprint = (game) => JSON.stringify([game.id, game.sportId || '', game.tournamentId || '', getGameShift(game), millis(game.dataHora), millis(game.limitePalpites), millis(game.updatedAt), game.timeA || '', game.timeB || '', game.groupName || '', game.stageType || '', getMatchState(game), millis(game.startedAt), game.seedLabelA || '', game.seedLabelB || ''])
export const schedulePlanFingerprint = (plan) => JSON.stringify(plan.after.map((game) => [game.id, millis(game.dataHora)]))
export const canReorderGame = (game, now) => getMatchState(game) === MATCH_STATE.SCHEDULED && !game.startedAt && !game.seedLabelA && !game.seedLabelB && game.stageType !== 'knockout' && !game.sourceGameIdA && !game.sourceGameIdB && Boolean(game.groupName || ['group', 'league'].includes(game.stageType) || key(game.fase).includes('grupos')) && millis(game.dataHora) > now.getTime()

export function buildScheduleRedistribution(games, now = new Date()) {
  const available = games.filter((game) => canReorderGame(game, now)).sort((a, b) => millis(a.dataHora) - millis(b.dataHora) || a.id.localeCompare(b.id))
  const days = new Map()
  available.forEach((game) => { const day = JSON.stringify([schoolDay(game.dataHora), getGameShift(game), venueKey(game.venue), venueKey(game.venueArea)]); if (!days.has(day)) days.set(day, []); days.get(day).push(game) })
  const changes = [], before = [], after = []
  days.forEach((slots) => {
    const candidate = orderRoundRobinGames(slots)
    const oldRest = scheduleRestSummary(slots), newRest = scheduleRestSummary(candidate)
    const ordered = newRest.consecutive > oldRest.consecutive || (newRest.consecutive === oldRest.consecutive && (newRest.minimumGap ?? 0) < (oldRest.minimumGap ?? 0)) ? slots : candidate
    before.push(...slots)
    ordered.forEach((game, index) => {
      const target = slots[index]
      const delta = millis(target.dataHora) - millis(game.dataHora)
      const deadline = millis(game.limitePalpites)
      const next = { ...game, dataHora: target.dataHora, limitePalpites: deadline == null ? game.limitePalpites : new Date(deadline + delta) }
      after.push(next)
      if (delta) changes.push({ id: game.id, dataHora: target.dataHora, expected: scheduleFingerprint(game) })
    })
  })
  return { before, after, changes, beforeSummary: scheduleRestSummary(before), afterSummary: scheduleRestSummary(after) }
}
