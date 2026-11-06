import { getMatchScore, getMatchState, getMatchCondition, MATCH_STATE } from '../utils/match.js'
import { getGameStageLabel, getSportIcon } from '../utils/game.js'
import { getSportProfile, formatSportScore } from '../utils/sportRules.js'
import { currentSetScore } from '../utils/liveEvents.js'
import { eventDate, SCHOOL_TIMEZONE } from '../utils/tvSchedule.js'
import { matchVenueLabel } from '../utils/matchVenue.js'
import MatchBadge from './MatchBadge.jsx'
import MatchNotice from './MatchNotice.jsx'
import { MatchClockDisplay } from './MatchClock.jsx'
import TVMatchEvents from './TVMatchEvents.jsx'

const colors = { Azul:'#4285f4', Amarelo:'#fddd50', Vermelho:'#ee5e69', Verde:'#55c993', Laranja:'#fb9847', Rosa:'#f39acf', Branco:'#fff', Preto:'#151820', Roxo:'#b58df5' }

export default function TVMatchCard({ game, now, showClock }) {
  const state = getMatchState(game)
  const live = state === MATCH_STATE.LIVE
  const finished = state === MATCH_STATE.FINISHED
  const profile = getSportProfile(game)
  const set = currentSetScore(game)
  const setsComplete = profile.scoringMode === 'sets' && Math.max(game.liveScoreA || 0, game.liveScoreB || 0) >= Math.ceil(profile.volleyballBestOf / 2)
  const scoringSet = profile.scoringMode === 'sets' && live && !setsComplete
  const score = scoringSet ? [set.a, set.b] : getMatchScore(game)
  const date = eventDate(game.dataHora)
  const when = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(date) : 'A definir'
  const day = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, day: '2-digit', month: '2-digit' }).format(date) : ''
  return <article className={`tv-match-card tv-match-card-${state}`}>
    <div className="tv-match-card-meta"><span>{getSportIcon(game.esporteNome)} {game.esporteNome}</span><MatchBadge game={game} /></div>
    <p className="tv-match-stage">{game.tournamentName ? `${game.tournamentName} · ` : ''}{getGameStageLabel(game)}</p>
    {!live && !finished ? <div className="tv-agenda-time"><strong>{state === MATCH_STATE.POSTPONED ? 'A reagendar' : state === MATCH_STATE.CANCELLED ? 'Cancelado' : when}</strong><span>{day}</span></div> : null}
    <div className="tv-match-scoreboard">{['A', 'B'].map((side, index) => <div className="tv-team" key={side}><strong>{game[`time${side}`] || 'A definir'}</strong>{game[`vest${side}`] ? <span className="tv-team-vest" style={{ '--vest-color': colors[game[`vest${side}`]] }}>Colete {game[`vest${side}`].toLocaleLowerCase('pt-BR')}</span> : null}{index === 0 ? <div className="tv-score-center">{getMatchCondition(game) === 'walkover' && !Number.isFinite(game.placarA) ? <b>W.O.</b> : live || finished ? <><b>{formatSportScore(score[0])}</b><span>:</span><b>{formatSportScore(score[1])}</b></> : <span>×</span>}</div> : null}</div>)}</div>
    {profile.scoringMode === 'sets' && (live || finished) ? <div className="tv-volley-score"><strong>{scoringSet ? `${set.number}º SET · PONTOS` : 'SETS FINAIS'}</strong><span>Sets: {live ? game.liveScoreA || 0 : game.placarA ?? '–'} × {live ? game.liveScoreB || 0 : game.placarB ?? '–'}</span>{game.setScores?.length ? <small>{game.setScores.map((item, index) => `${index + 1}º: ${item.a}–${item.b}`).join(' · ')}</small> : null}</div> : null}
    {live || finished ? <TVMatchEvents game={game} /> : null}
    {live && showClock ? <MatchClockDisplay game={game} now={now} /> : null}
    <MatchNotice game={game} />
    <div className="tv-match-venue"><span aria-hidden="true">⌖</span>{matchVenueLabel(game) || 'Local a definir na preparação'}</div>
  </article>
}
