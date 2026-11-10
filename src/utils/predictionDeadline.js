import { eventDate, SCHOOL_TIMEZONE } from './tvSchedule.js'

export const PREDICTION_CUTOFF_MINUTES = 5

export function automaticPredictionDeadline(game) {
  const kickoff = eventDate(game?.dataHora || game?.dateTime)
  return Number.isFinite(kickoff.getTime()) ? new Date(kickoff.getTime() - PREDICTION_CUTOFF_MINUTES * 60000) : null
}

export function predictionDeadlineInput(game) {
  const deadline = automaticPredictionDeadline(game)
  if (!deadline) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(deadline).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
