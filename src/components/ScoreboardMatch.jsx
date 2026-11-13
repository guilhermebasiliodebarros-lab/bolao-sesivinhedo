import { recentScoreEvent, scoreboardIncidents, scoreboardSport } from '../utils/scoreboard.js'
import ScoreboardIncidents, { IncidentIcon } from './ScoreboardIncidents.jsx'
import { getGameStageLabel } from '../utils/game.js'
import { getMatchCondition, getMatchLabel, getMatchState, MATCH_STATE } from '../utils/match.js'
import { getSportProfile, formatSportScore } from '../utils/sportRules.js'
import { scorePresentation } from '../utils/scorePresentation.js'
import { currentSetScore } from '../utils/liveEvents.js'
import { formatMatchClock, matchClockValue } from '../utils/matchClock.js'
import { matchPeriod } from '../utils/matchPeriods.js'
import { matchVenueLabel } from '../utils/matchVenue.js'
import { tieBreakSummary } from '../utils/tieBreak.js'
import { eventDate, schoolDay, SCHOOL_TIMEZONE } from '../utils/tvSchedule.js'
import './TVScoreboard.css'

const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, hour: '2-digit', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: SCHOOL_TIMEZONE, day: '2-digit', month: '2-digit' })
const vestColors = { Vermelho: '#ff6a72', Azul: '#71a8ff', Amarelo: '#ffdd66', Verde: '#74e1ae', Laranja: '#ffad66', Rosa: '#f4a3d2', Branco: '#fff', Preto: '#707784', Roxo: '#bca1ff' }

export function SportGlyph({ sport, className = '' }) {
  return <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="16" cy="16" r="12" />{sport === 'basketball' ? <><path d="M4 16h24M16 4v24M7 7c12 4 12 14 18 18M25 7C13 11 13 21 7 25" /></> : sport === 'volleyball' ? <><path d="m16 4 4 10-8 9M5 11l11 5 11-4M12 27l-1-11 8-10M27 20l-9-1" /></> : sport === 'football' ? <><path d="m16 10 6 4-2 7h-8l-2-7 6-4Zm0 0V4m6 10 6-2m-8 9 3 5m-11-5-3 5m1-12-6-2" /></> : <><path d="m8 8 16 16M24 8 8 24M4 16h24" /></>}</svg>
}

function scheduleTime(game, now) {
  const date = eventDate(game.dataHora)
  if (!Number.isFinite(date.getTime())) return 'Horário a definir'
  return `${schoolDay(date) === schoolDay(now) ? '' : `${dateFormat.format(date)} · `}${timeFormat.format(date)}`
}

export default function ScoreboardMatch({ game, now, showClock, connected }) {
  const state = getMatchState(game)
  const live = state === MATCH_STATE.LIVE
  const finished = state === MATCH_STATE.FINISHED
  const walkover = getMatchCondition(game) === 'walkover'
  const family = scoreboardSport(game)
  const profile = getSportProfile(game)
  const score = scorePresentation(game)
  const clock = matchClockValue(game, now)
  const period = matchPeriod(game, now)
  const set = currentSetScore(game)
  const inSet = profile.scoringMode === 'sets' && live && Math.max(game.liveScoreA || 0, game.liveScoreB || 0) < Math.ceil(profile.volleyballBestOf / 2)
  const event = connected ? recentScoreEvent(game, now) : null
  const incidents = scoreboardIncidents(game)
  const hasIncidents = incidents.length > 0
  const sets = live ? [game.liveScoreA || 0, game.liveScoreB || 0] : [game.placarA, game.placarB]
  const scoreUnit = profile.scoringMode === 'sets' ? inSet ? 'PONTOS' : 'SETS' : profile.scoringMode === 'goals' ? 'GOLS' : 'PONTOS'
  return <article className={`sb-match sb-match-${family}${live ? ' is-live' : ''}${event ? ' has-event' : ''}${hasIncidents ? ' has-incidents' : ''}`} data-game-id={game.id} aria-label={`${game.esporteNome}: ${game.timeA} contra ${game.timeB}`}>
    <header className="sb-match-header"><div className="sb-sport"><SportGlyph sport={family} /><h2>{game.esporteNome}</h2></div><span className={`sb-match-state${live && connected ? ' is-live' : ''}`}>{live && connected ? <i /> : null}{live && !connected ? 'Último placar' : getMatchLabel(game)}</span></header>
    <div className="sb-match-context"><span>{matchVenueLabel(game) || 'Interclasse SESI Vinhedo'}</span><span title={getGameStageLabel(game)}>{getGameStageLabel(game)}</span></div>
    <div className="sb-duel">{['A', 'B'].map((side, index) => <div className={`sb-team sb-team-${side}`} key={side}>
      <h3 title={game[`time${side}`]}>{game[`time${side}`] || 'A definir'}</h3>
      {live || finished ? <output className="sb-score" aria-label={`Placar de ${game[`time${side}`] || side}`} aria-live="polite"><span key={`${score.values?.[index]}:${scoreUnit}`} data-digits={String(score.values?.[index] ?? '').length}>{score.values ? formatSportScore(score.values[index]) : walkover ? '—' : score.text}</span></output> : <div className="sb-awaiting-score">—</div>}
      <span className="sb-team-detail">{walkover ? <b>{game.walkoverWinner === side ? 'VENCEU POR W.O.' : 'W.O.'}</b> : profile.scoringMode === 'sets' && (live || finished) ? <b>{formatSportScore(sets[index])} <small>SETS</small></b> : live || finished ? <b>{scoreUnit}</b> : <b>EQUIPE {side}</b>}{game[`vest${side}`] ? <span className="sb-vest"><i style={{ backgroundColor: vestColors[game[`vest${side}`]] || '#b8c4d6' }} />{game[`vest${side}`]}</span> : null}</span>
    </div>)}<div className="sb-duel-center">{live ? <>{profile.scoringMode === 'sets' ? <span className="sb-set-number">{inSet ? `${set.number}º SET` : 'SETS DEFINIDOS'}</span> : period.supported ? <span className={`sb-period-label${period.interval ? ' is-interval' : ''}`}>{period.label}</span> : <span className="sb-versus">VS</span>}{showClock ? <><span className="sb-clock-label">{clock.running ? 'TEMPO DE JOGO' : 'TEMPO PAUSADO'}</span><time className={`sb-match-clock${!clock.running ? ' is-paused' : ''}`}>{formatMatchClock(period.supported ? period.elapsedMs : clock.elapsedMs)}</time>{period.supported && period.number > 1 ? <small>Acumulado: {formatMatchClock(clock.elapsedMs)}</small> : null}{period.exceeded ? <small>Tempo previsto atingido</small> : null}</> : null}</> : finished ? <><span className="sb-versus">FIM</span><small>{getMatchCondition(game) === 'walkover' ? 'Vitória por W.O.' : 'Placar final'}</small></> : <><span className="sb-clock-label">INÍCIO PREVISTO</span><strong className="sb-kickoff">{scheduleTime(game, now)}</strong></>}</div></div>
    {hasIncidents ? <ScoreboardIncidents game={game} now={now} recent={event} incidents={incidents} /> : null}
    {!hasIncidents || profile.scoringMode === 'sets' || game.tieBreak ? <footer className="sb-match-footer">{event && !hasIncidents ? <div className="sb-score-event" key={`${event.id}:${event.label}`} role="status"><IncidentIcon kind={event.kind} /><strong>{event.label}</strong><span>{event.player ? `${event.player} · ` : ''}{event.team}{event.minute !== null ? ` · ${event.minute}′` : ''}</span></div> : profile.scoringMode === 'sets' && game.setScores?.length ? <div className="sb-set-history">{game.setScores.map((partial, index) => <span key={index}><small>{index + 1}º SET</small><b>{partial.a} : {partial.b}</b></span>)}</div> : <div className="sb-match-note"><span className="sb-note-line" />{game.tieBreak ? tieBreakSummary(game) : finished ? game.tournamentName || 'Resultado confirmado pela organização' : live ? game.eventsAdjusted ? 'Placar atualizado pela organização' : 'Cada lance conta. Torça pela sua turma.' : game.tournamentName || 'O placar aparece automaticamente ao iniciar.'}<span className="sb-note-line" /></div>}</footer> : null}
  </article>
}

