import { eventDate, schoolDay, SCHOOL_TIMEZONE } from './tvSchedule.js'
import { getMatchCondition, getMatchState, MATCH_STATE } from './match.js'
import { scheduleResources, sharesScheduleResources } from './scheduleConflicts.js'
import { venuesOverlap } from './matchVenue.js'
import { calendarConflicts, canScheduleGame } from './visualSchedule.js'

const time = (game) => eventDate(game?.dataHora).getTime()
const duration = (game) => Number(game.durationMinutes) > 0 ? Number(game.durationMinutes) : 30
const instant = (value) => { const number = eventDate(value).getTime(); return Number.isFinite(number) ? number : null }

export function schoolDateTimeInput(value) {
  const date = eventDate(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

// Scoring changes do not invalidate a schedule preview; resource and state changes do.
export function delayScheduleFingerprint(games, teams = []) {
  const fields = ['sportId', 'esporteNome', 'timeA', 'timeB', 'teamIdA', 'teamIdB', 'turmaA', 'turmaB', 'venue', 'venueArea', 'sourceGameIdA', 'sourceGameIdB', 'nextGameId', 'seedLabelA', 'seedLabelB']
  return JSON.stringify([
    games.map((game) => [game.id, instant(game.dataHora), duration(game), getMatchState(game), getMatchCondition(game), game.status, instant(game.startedAt), Boolean(game.deletionPending), ...fields.map((field) => game[field] || '')]).sort((a, b) => a[0].localeCompare(b[0])),
    teams.map((team) => [team.id, team.sportId || '', team.nome || '', team.turma || '']).sort((a, b) => a[0].localeCompare(b[0])),
  ])
}

export const delayPlanFingerprint = (plan) => JSON.stringify(plan.changes.map(({ game, after }) => [game.id, after.dataHora]))

export function buildDelayImpact(games, teams, { anchorId, minutes, now = new Date() }) {
  const amount = Number(minutes)
  if (!Number.isInteger(amount) || amount < 1 || amount > 240) throw new Error('Informe um atraso entre 1 e 240 minutos.')
  const anchor = games.find((game) => game.id === anchorId)
  if (!canScheduleGame(anchor) || !Number.isFinite(time(anchor))) throw new Error('Selecione uma partida agendada, com horário definido e que ainda não começou.')
  const day = schoolDay(anchor.dataHora)
  const ordered = games.filter((game) => Number.isFinite(time(game))).sort((a, b) => time(a) - time(b) || a.id.localeCompare(b.id))
  const byId = new Map(ordered.map((game) => [game.id, game]))
  if (byId.size !== ordered.length) throw new Error('Há partidas repetidas na agenda. Atualize os dados antes de simular.')
  const resources = new Map(ordered.map((game) => [game.id, scheduleResources(game, teams)]))
  const incoming = new Map(ordered.map((game) => [game.id, new Map()]))
  const outgoing = new Map(ordered.map((game) => [game.id, new Set()]))
  const addEdge = (from, to, reason) => {
    if (from === to || !byId.has(from) || !byId.has(to)) return
    const reasons = incoming.get(to).get(from) || new Set()
    reasons.add(reason); incoming.get(to).set(from, reasons); outgoing.get(from).add(to)
  }
  const reserves = (game) => ![MATCH_STATE.FINISHED, MATCH_STATE.CANCELLED, MATCH_STATE.POSTPONED].includes(getMatchState(game)) && getMatchCondition(game) === 'normal'
  for (let first = 0; first < ordered.length; first += 1) {
    const a = ordered[first]
    for (let second = first + 1; second < ordered.length; second += 1) {
      const b = ordered[second]
      if (schoolDay(a.dataHora) !== day || schoolDay(b.dataHora) !== day || !reserves(a) || !reserves(b)) continue
      // An explicit bracket link takes priority over a same-time resource ordering.
      const reversed = [a.sourceGameIdA, a.sourceGameIdB].includes(b.id) || b.nextGameId === a.id
      if (reversed) continue
      if (venuesOverlap(a, b)) addEdge(a.id, b.id, 'Mesma quadra / área')
      if (sharesScheduleResources(resources.get(a.id), resources.get(b.id))) addEdge(a.id, b.id, 'Mesma equipe / turma')
    }
    for (const parent of [a.sourceGameIdA, a.sourceGameIdB].filter(Boolean)) addEdge(parent, a.id, 'Fase anterior')
    if (a.nextGameId) addEdge(a.id, a.nextGameId, 'Fase anterior')
  }

  // Only the selected match and its successors can change. Unrelated broken brackets
  // must not prevent another court from reviewing a delay.
  const reachable = new Set([anchorId])
  const pending = [anchorId]
  while (pending.length) for (const id of outgoing.get(pending.shift()) || []) if (!reachable.has(id)) { reachable.add(id); pending.push(id) }
  const degree = new Map([...reachable].map((id) => [id, [...incoming.get(id).keys()].filter((parent) => reachable.has(parent)).length]))
  const queue = ordered.filter((game) => reachable.has(game.id) && degree.get(game.id) === 0).map((game) => game.id)
  const starts = new Map(ordered.map((game) => [game.id, time(game)]))
  const changed = new Set(), reasons = new Map(), issues = []
  let visited = 0
  while (queue.length) {
    const id = queue.shift(), game = byId.get(id)
    visited += 1
    let required = id === anchorId ? time(anchor) + amount * 60000 : time(game)
    const causes = new Set(id === anchorId ? ['Atraso informado'] : [])
    for (const [parentId, why] of incoming.get(id)) {
      const parent = byId.get(parentId)
      const end = starts.get(parentId) + duration(parent) * 60000
      if (end > required && (id === anchorId || changed.has(parentId))) { required = end; why.forEach((reason) => causes.add(reason)) }
    }
    if (required > time(game)) {
      // Account for fixed reservations too once a match is affected by the cascade.
      for (const [parentId, why] of incoming.get(id)) {
        const end = starts.get(parentId) + duration(byId.get(parentId)) * 60000
        if (end > required) { required = end; why.forEach((reason) => causes.add(reason)) }
      }
      // Datetime inputs have minute precision. Round forward so legacy timestamps
      // containing seconds never shorten the requested delay or overlap the next game.
      required = Math.ceil(required / 60000) * 60000
      if (!canScheduleGame(game)) issues.push({ id, message: `${game.timeA} × ${game.timeB} já começou ou está indisponível e impede este ajuste.` })
      else if (schoolDay(game.dataHora) !== day) issues.push({ id, message: 'O atraso afeta uma partida de outro dia. Reagende esses jogos separadamente.' })
      else { starts.set(id, required); changed.add(id); reasons.set(id, [...causes]) }
    }
    for (const child of outgoing.get(id)) if (reachable.has(child)) { degree.set(child, degree.get(child) - 1); if (degree.get(child) === 0) queue.push(child) }
  }
  if (visited !== reachable.size) issues.push({ id: anchorId, message: 'Há uma dependência circular entre partidas afetadas. Corrija o chaveamento antes de aplicar o atraso.' })
  const after = games.map((game) => changed.has(game.id) ? { ...game, dataHora: schoolDateTimeInput(new Date(starts.get(game.id))) } : game)
  const changes = ordered.filter((game) => changed.has(game.id)).map((game) => ({ game, after: after.find((item) => item.id === game.id), minutes: Math.ceil((starts.get(game.id) - time(game)) / 60000), reasons: reasons.get(game.id) }))
  for (const change of changes) {
    if (schoolDay(change.after.dataHora) !== day || schoolDay(new Date(time(change.after) + duration(change.after) * 60000)) !== day) issues.push({ id: change.game.id, message: 'Um novo horário ultrapassa o dia da programação. Ajuste esse jogo separadamente.' })
    if (time(change.after) <= now.getTime()) issues.push({ id: change.game.id, message: 'Um dos novos horários já passou. Aumente o atraso ou reagende essa partida.' })
    for (const conflict of calendarConflicts(change.after, after, teams)) issues.push({ id: change.game.id, message: `${change.game.timeA} × ${change.game.timeB}: ${conflict.reasons.join(' e ')} com ${conflict.game.timeA} × ${conflict.game.timeB}.` })
  }
  return { day, anchorId, minutes: amount, changes, after, issues: [...new Map(issues.map((issue) => [JSON.stringify(issue), issue])).values()], maxDelay: Math.max(0, ...changes.map((change) => change.minutes)) }
}
