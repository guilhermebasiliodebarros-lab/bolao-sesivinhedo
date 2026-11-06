import { useState } from 'react'
import { startPreparedGames } from '../services/bolaoService.js'
import { isMatchPrepared } from '../utils/matchStart.js'
import MatchDetails from './MatchDetails.jsx'
import { formatDateTime } from '../utils/format.js'

export default function PreparedMatches({ games, teams, disabled, sport = '' }) {
  const [ids, setIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const ready = games.filter((game) => (!sport || game.sportId === sport || game.esporteNome === sport) && isMatchPrepared(game, teams))
  const selected = ready.filter((game) => ids.includes(game.id))
  return <section className="prepared-matches" aria-label="Partidas prontas para iniciar"><div className="section-heading"><div><span className="eyebrow">Conferência concluída</span><h3>Prontas para iniciar</h3><p>Selecione as partidas que começarão juntas. Basquete e vôlei podem usar áreas diferentes da mesma quadra.</p></div><span>{ready.length} pronta(s)</span></div>
    {ready.length ? <><div className="prepared-match-list">{ready.map((game) => <label className="prepared-match-row" key={game.id}><input type="checkbox" checked={ids.includes(game.id)} disabled={busy || disabled} onChange={(event) => setIds((current) => event.target.checked ? [...current, game.id] : current.filter((id) => id !== game.id))} /><span><strong>{game.esporteNome} · {game.timeA} × {game.timeB}</strong><small>{formatDateTime(game.dataHora)}</small><MatchDetails game={game} compact /></span></label>)}</div><button className="btn btn-primary" type="button" disabled={busy || disabled || !selected.length || selected.length > 12} onClick={async () => {
      setBusy(true); setMessage(''); setFailed(false)
      try { await startPreparedGames(selected.map((game) => game.id)); setIds([]); setMessage(`${selected.length} partida(s) iniciada(s) juntas. Os palpites foram bloqueados e a TV atualizada.`) }
      catch (error) { setFailed(true); setMessage(error.message) } finally { setBusy(false) }
    }}>{busy ? 'Iniciando…' : `Iniciar ${selected.length || ''} partida(s) selecionada(s)`}</button>{selected.length > 12 ? <p>Selecione até 12 partidas por início conjunto.</p> : null}</> : <p>Use Preparar partida e salve a conferência para deixar os jogos nesta lista.</p>}
    {message ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{message}</div> : null}
  </section>
}
