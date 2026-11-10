import { getMatchCondition, getMatchScore, getMatchState, MATCH_STATE } from './match.js'
import { currentSetScore } from './liveEvents.js'
import { formatSportScore, getSportProfile } from './sportRules.js'

// Displaying volleyball points must never change the set totals used for predictions and standings.
export function scorePresentation(game) {
  const state = getMatchState(game)
  const profile = getSportProfile(game)
  const totals = getMatchScore(game)
  const active = [MATCH_STATE.LIVE, MATCH_STATE.FINISHED].includes(state)
  if (getMatchCondition(game) === 'walkover' && (!Number.isFinite(game.placarA) || !Number.isFinite(game.placarB))) return { text: 'W.O.', values: null, caption: '', partials: '' }
  if (!active) return { text: '×', values: null, caption: '', partials: '' }
  const isSets = profile.scoringMode === 'sets'
  const set = currentSetScore(game)
  const inSet = isSets && state === MATCH_STATE.LIVE && Math.max(...totals.map(Number)) < Math.ceil(profile.volleyballBestOf / 2)
  const values = inSet ? [set.a, set.b] : totals
  const caption = isSets ? `${inSet ? `${set.number}º set · pontos · ` : ''}Sets: ${totals.map(formatSportScore).join(' × ')}` : ''
  const partials = isSets ? (game.setScores || []).map((item, index) => `${index + 1}º: ${item.a}–${item.b}`).join(' · ') : ''
  return { values, text: values.map(formatSportScore).join(' × '), caption, partials }
}
