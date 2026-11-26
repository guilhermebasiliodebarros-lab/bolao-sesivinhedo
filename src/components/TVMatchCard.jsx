import { getMatchScore, getMatchState, getMatchCondition, MATCH_STATE } from '../utils/match.js'
import { getGameStageLabel, getSportIcon } from '../utils/game.js'
import { getSportProfile, formatSportScore } from '../utils/sportRules.js'
import { currentSetScore } from '../utils/liveEvents.js'
import { eventDate, SCHOOL_TIMEZONE } from '../utils/tvSchedule.js'
import { matchVenueLabel } from '../utils/matchVenue.js'
import MatchBadge from './MatchBadge.jsx'
import MatchNotice from './MatchNotice.jsx'
import { MatchClockDisplay } from './MatchClock.jsx'
import ScoreboardIncidents from './ScoreboardIncidents.jsx'
import { recentScoreEvent, scoreboardIncidents } from '../utils/scoreboard.js'
import { decadeTeamStyle, matchDecadeIdentities } from '../utils/decadeIdentities.js'
import { DecadeEmblem } from './DecadeArtwork.jsx'
import './DecadesScoreboard.css'

const colors = { Azul:'#4285f4', Amarelo:'#fddd50', Vermelho:'#ee5e69', Verde:'#55c993', Laranja:'#fb9847', Rosa:'#f39acf', Branco:'#fff', Preto:'#151820', Roxo:'#b58df5' }

export default function TVMatchCard({ game, now, showClock, connected }) {
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
  const identities = matchDecadeIdentities(game)
  const activity = live || finished
  const showSets = profile.scoringMode === 'sets' && activity
  const showMatchTime = live && showClock
  return <article className={`tv-match-card tv-match-card-${state}${activity ? ' has-activity' : ''}`} data-game-id={game.id}>
    <div className="tv-match-card-meta"><span>{getSportIcon(game.esporteNome)} {game.esporteNome}</span><MatchBadge game={game} /></div>
    <p className="tv-match-stage">{game.tournamentName ? `${game.tournamentName} · ` : ''}{getGameStageLabel(game)}</p>
    {!live && !finished ? <div className="tv-agenda-time"><strong>{state === MATCH_STATE.POSTPONED ? 'A reagendar' : state === MATCH_STATE.CANCELLED ? 'Cancelado' : when}</strong><span>{day}</span></div> : null}
    <div className="tv-match-scoreboard">
      {['A', 'B'].map((side) => {
        const identity = identities[side]
        const vest = game[`vest${side}`]
        return <div className={`tv-team tv-team-${side} tv-decade-team decade-team`} key={side} data-era={identity.decade || 'neutral'} style={decadeTeamStyle(identity)}>
          <strong>{game[`time${side}`] || 'A definir'}</strong>
          <div className="tv-team-details">
            <span className="tv-era-label"><DecadeEmblem decade={identity.decade} />{identity.label}</span>
            {vest ? <span className="tv-team-vest" style={{ '--vest-color': colors[vest] }}>Colete {vest.toLocaleLowerCase('pt-BR')}</span> : null}
          </div>
        </div>
      })}
      <div className="tv-score-center">
        {getMatchCondition(game) === 'walkover' && !Number.isFinite(game.placarA) ? <b className="tv-walkover">W.O.</b>
          : activity ? <><b data-digits={String(score[0]).length}>{formatSportScore(score[0])}</b><span aria-hidden="true">:</span><b data-digits={String(score[1]).length}>{formatSportScore(score[1])}</b></>
            : <span aria-hidden="true">×</span>}
      </div>
    </div>
    {showSets || showMatchTime ? <div className="tv-match-details">
      {showSets ? <div className="tv-volley-score"><strong>{scoringSet ? `${set.number}º SET · PONTOS` : 'SETS FINAIS'}</strong><span>Sets: {live ? game.liveScoreA || 0 : game.placarA ?? '–'} × {live ? game.liveScoreB || 0 : game.placarB ?? '–'}</span>{game.setScores?.length ? <small>{game.setScores.map((item, index) => `${index + 1}º: ${item.a}–${item.b}`).join(' · ')}</small> : null}</div> : null}
      {showMatchTime ? <MatchClockDisplay game={game} now={now} /> : null}
    </div> : null}
    <MatchNotice game={game} />
    {activity ? <ScoreboardIncidents game={game} now={now} recent={connected ? recentScoreEvent(game, now) : null} incidents={scoreboardIncidents(game)} /> : null}
    <div className="tv-match-venue">{matchVenueLabel(game) || 'Local a definir na preparação'}</div>
  </article>
}
