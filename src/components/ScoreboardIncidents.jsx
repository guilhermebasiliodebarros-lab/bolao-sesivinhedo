export function IncidentIcon({ kind }) {
  if (kind === 'yellow' || kind === 'red') return <span className={`sb-incident-card is-${kind}`} role="img" aria-label={kind === 'yellow' ? 'Cartão amarelo' : 'Cartão vermelho'} />
  return <span className="sb-incident-ball" role="img" aria-label={kind === 'goal' ? 'Gol' : kind === 'set' ? 'Set' : 'Ponto'}>{kind === 'goal' ? '⚽' : kind === 'set' ? '✓' : '●'}</span>
}

export default function ScoreboardIncidents({ game, now, recent, incidents }) {
  if (!incidents.length) return null
  return <section className="sb-incidents" aria-label="Lances da partida">
    <div className="sb-incidents-heading"><span>LANCES DA PARTIDA</span>{recent ? <span className={`sb-incident-flash is-${recent.kind}`} key={`${recent.id}:${recent.label}`} role="status"><IncidentIcon kind={recent.kind} /><strong>{recent.label}</strong><span>{recent.player || recent.team}{recent.minute !== null ? ` · ${recent.minute}′` : ''}</span></span> : <span>Gols, pontos e cartões</span>}</div>
    <div className="sb-incidents-teams">{['A', 'B'].map((side) => {
      const teamIncidents = incidents.filter((item) => item.side === side)
      const pages = Math.ceil(teamIncidents.length / 3)
      const page = pages ? Math.floor(now.getTime() / 10000) % pages : 0
      return <div className={`sb-incidents-team is-${side}`} key={side} aria-label={`Lances de ${game[`time${side}`]}`}>
        <div className="sb-incidents-team-heading"><strong>{game[`time${side}`]}</strong>{pages > 1 ? <span>{page + 1} / {pages}</span> : null}</div>
        {teamIncidents.length ? <ul key={page}>{teamIncidents.slice(page * 3, page * 3 + 3).map((incident) => <li key={incident.id}>
          <IncidentIcon kind={incident.kind} />
          <span className="sb-incident-player">{incident.player || 'Equipe'}{incident.kind === 'point' ? <small>+{incident.value}</small> : incident.total > 1 ? <small>{incident.total} gols</small> : null}</span>
          <span className="sb-incident-minute">{incident.minutes?.length ? <>{incident.minutes.map((minute) => `${minute}′`).join(', ')}{incident.total > incident.minutes.length ? ` +${incident.total - incident.minutes.length}` : ''}</> : incident.minute !== null ? `${incident.minute}′` : '—'}</span>
        </li>)}</ul> : <p>Nenhum lance registrado</p>}
      </div>
    })}</div>
  </section>
}
