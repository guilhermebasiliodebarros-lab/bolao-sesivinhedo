import { eventIcon, eventMinute } from '../utils/liveEvents.js'
import { getSportProfile } from '../utils/sportRules.js'

export default function TVMatchEvents({ game }) {
  const last = game.liveEvents?.at(-1)
  const goal = getSportProfile(game).scoringMode === 'goals'
  const scorers = game.scorerStats || []
  return <div className="tv-match-events">
    {last ? <div className={`tv-latest-event${last.kind === 'goal' ? ' is-goal' : ''}`} key={last.id}><span className="tv-event-icon" aria-hidden="true">{eventIcon(last)}</span><div><strong>{last.kind === 'set' ? `Fim do ${last.setNumber}º set · ${last.setScore.a} × ${last.setScore.b}` : `${last.kind === 'goal' ? 'GOL' : `+${last.value} PONTO${last.value > 1 ? 'S' : ''}`} · ${last.playerName || game[`time${last.side}`]}`}</strong><small>{last.kind !== 'set' && last.playerName ? game[`time${last.side}`] : 'Último lance registrado'} · {eventMinute(last)}{last.setNumber ? ` · ${last.setNumber}º set` : ''}{game.eventsAdjusted ? ' · após ajuste manual' : ''}</small></div></div> : <p className="tv-event-empty">{game.eventsAdjusted ? 'Placar ajustado pela organização' : 'Acompanhe o placar em tempo real'}</p>}
    {goal && scorers.length ? <div className="tv-goal-authors">{['A', 'B'].map((side) => { const list = scorers.filter((item) => item.side === side); return <span key={side}>{list.slice(0, 2).map((item) => <span key={item.playerId}>⚽ {item.playerName}{item.total > 1 ? ` (${item.total})` : ''} <small>{item.minutes.map((minute) => `${minute}′`).join(', ')}</small></span>)}{list.length > 2 ? <small>+{list.length - 2} autor(es)</small> : null}</span> })}</div> : null}
  </div>
}
