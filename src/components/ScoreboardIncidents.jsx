import { useLayoutEffect, useRef, useState } from 'react'
import './ScoreboardIncidents.css'

export function IncidentIcon({ kind }) {
  if (kind === 'yellow' || kind === 'red') return <span className={`sb-incident-card is-${kind}`} role="img" aria-label={kind === 'yellow' ? 'Cartão amarelo' : 'Cartão vermelho'} />
  return <span className="sb-incident-ball" role="img" aria-label={kind === 'goal' ? 'Gol' : kind === 'set' ? 'Set' : 'Ponto'}>{kind === 'goal' ? '⚽' : kind === 'set' ? '✓' : '●'}</span>
}

function useIncidentSpace() {
  const listRef = useRef(null)
  const [space, setSpace] = useState({ rows: 2, minutes: 2 })

  useLayoutEffect(() => {
    const list = listRef.current
    const measure = () => {
      const style = getComputedStyle(list)
      const rowHeight = Number.parseFloat(style.gridAutoRows)
      const gap = Number.parseFloat(style.rowGap) || 0
      const rows = Math.max(1, Math.floor((list.clientHeight + gap) / (rowHeight + gap)) || 1)
      const minutes = list.clientWidth >= 400 ? 6 : list.clientWidth >= 245 ? 4 : 2
      setSpace((previous) => previous.rows === rows && previous.minutes === minutes ? previous : { rows, minutes })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [])

  return { listRef, ...space }
}

function IncidentRow({ incident, minuteLimit, rotation }) {
  const isGoal = incident.kind === 'goal'
  const total = incident.total
  const count = isGoal ? `${total} ${total === 1 ? 'gol' : 'gols'}` : `${total} ${total === 1 ? 'pt' : 'pts'}`
  const minutes = incident.minutes || []
  const groups = Math.ceil(minutes.length / minuteLimit)
  const group = groups ? rotation % groups : 0
  const formatMinutes = (values) => values.map((value) => `${value}′`).join(', ')

  return <li className={`sb-incident-row is-${incident.kind}`}>
    <IncidentIcon kind={incident.kind} />
    <span className="sb-incident-player" title={incident.player}>{incident.player || 'Sem autor'}</span>
    {total ? <b className="sb-incident-total">{count}</b> : null}
    {isGoal && minutes.length ? <span className="sb-incident-minute" title={formatMinutes(minutes)}>
      {formatMinutes(minutes.slice(group * minuteLimit, (group + 1) * minuteLimit))}
      {groups > 1 ? <small> · {group + 1}/{groups}</small> : null}
    </span> : null}
    {!isGoal && incident.minute !== null ? <span className="sb-incident-minute">{incident.minute}′</span> : null}
  </li>
}

export default function ScoreboardIncidents({ game, now, recent, incidents }) {
  const { listRef, rows, minutes } = useIncidentSpace()
  const phase = Math.floor(now.getTime() / 6500)

  return <section className="sb-incidents" aria-label="Lances da partida">
    <div className="sb-incidents-heading">
      <strong>Lances da partida</strong>
      {recent ? <span className={`sb-incident-flash is-${recent.kind}`} key={`${recent.id}:${recent.label}`} role="status">
        <IncidentIcon kind={recent.kind} />
        <b>{recent.label}</b>
        <span>{recent.player || recent.team}{recent.minute !== null && recent.kind !== 'point' ? ` · ${recent.minute}′` : ''}</span>
      </span> : null}
    </div>
    <div className="sb-incidents-teams">
      {['A', 'B'].map((side) => {
        const team = game[`time${side}`]
        const teamIncidents = incidents.filter((item) => item.side === side)
        const pages = Math.max(1, Math.ceil(teamIncidents.length / rows))
        const page = phase % pages
        const visible = teamIncidents.slice(page * rows, (page + 1) * rows)
        return <div className={`sb-incidents-team is-${side}`} key={side} aria-label={`Lances de ${team}`}>
          <div className="sb-incidents-team-heading">
            <strong title={team}>{team}</strong>
            {pages > 1 ? <span>{page + 1} / {pages}</span> : null}
          </div>
          <ul ref={side === 'A' ? listRef : null}>
            {visible.length ? visible.map((incident) => <IncidentRow key={incident.id} incident={incident} minuteLimit={minutes} rotation={Math.floor(phase / pages)} />)
              : <li className="sb-incidents-empty">Nenhum lance registrado</li>}
          </ul>
        </div>
      })}
    </div>
  </section>
}
