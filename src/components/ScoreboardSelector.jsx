import { useEffect, useState } from 'react'
import { saveScoreboardSelection, subscribeScoreboardSelection } from '../services/bolaoService.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import { gameMatchesSearch, getUniqueGameSports } from '../utils/game.js'
import { getGameShift, shiftLabel } from '../utils/schoolShifts.js'
import { formatDateTime } from '../utils/format.js'
import { matchVenueLabel } from '../utils/matchVenue.js'
import MatchBadge from './MatchBadge.jsx'
import './ScoreboardSelector.css'

export default function ScoreboardSelector({ games, disabled = false }) {
  const [selection, setSelection] = useState({ gameIds: [], revision: 0 })
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [sport, setSport] = useState('')
  const [turno, setTurno] = useState('')

  useEffect(() => subscribeScoreboardSelection((value) => { setSelection(value); setLoading(false); setLoadError('') }, (error) => { setLoadError(error); setLoading(false) }), [])

  const value = draft || selection
  const stale = draft && draft.revision !== selection.revision
  const locked = disabled || busy || loading || Boolean(loadError)
  const eligible = games.filter((game) => !game.deletionPending && !game.seedLabelA && !game.seedLabelB && game.timeA && game.timeB
    && [MATCH_STATE.LIVE, MATCH_STATE.SCHEDULED].includes(getMatchState(game)))
  const candidates = eligible.filter((game) => (!sport || game.sportId === sport || game.esporteNome === sport)
    && (!turno || getGameShift(game) === turno) && gameMatchesSearch(game, search))
    .sort((a, b) => Number(getMatchState(b) === MATCH_STATE.LIVE) - Number(getMatchState(a) === MATCH_STATE.LIVE)
      || String(a.esporteNome).localeCompare(String(b.esporteNome), 'pt-BR')
      || String(a.dataHora?.toMillis?.() || a.dataHora || '').localeCompare(String(b.dataHora?.toMillis?.() || b.dataHora || ''))
      || a.id.localeCompare(b.id))

  const toggle = (id) => {
    if (locked || stale) return
    const gameIds = value.gameIds.includes(id) ? value.gameIds.filter((item) => item !== id) : [...value.gameIds, id]
    if (gameIds.length > 2) return
    setDraft({ gameIds, revision: value.revision })
    setMessage('')
  }
  const publish = async (event) => {
    event.preventDefault()
    if (locked || stale) return
    setBusy(true); setMessage(''); setFailed(false)
    try {
      const next = await saveScoreboardSelection(value.gameIds, value.revision)
      setSelection(next); setDraft(null)
      setMessage(next.gameIds.length ? 'Seleção publicada. A TV mostra somente estes jogos.' : 'TV em espera. Nenhuma partida será exibida até uma nova seleção.')
    } catch (error) { setMessage(error.message); setFailed(true) }
    finally { setBusy(false) }
  }

  return <section className="scoreboard-selector" aria-label="Escolher jogos do placar da TV">
    <div className="section-heading"><div><span className="eyebrow">Você controla a transmissão</span><h3>Escolher jogos do placar</h3><p>Marque um jogo para ocupar a tela inteira ou dois para exibir lado a lado. Depois, clique em Transmitir seleção.</p></div><span className="scoreboard-selection-status">{selection.gameIds.length ? `${selection.gameIds.length} ${selection.gameIds.length === 1 ? 'jogo na TV' : 'jogos na TV'}` : 'TV em espera'}</span></div>
    {loadError ? <p className="alert alert-error" role="alert">{loadError}</p> : null}
    {stale ? <div className="schedule-warning" role="status">Outro responsável alterou os jogos da TV. <button type="button" className="btn btn-outline btn-small" onClick={() => { setDraft(null); setMessage('') }}>Carregar seleção atual</button></div> : null}
    <form onSubmit={publish}>
      <fieldset disabled={locked || Boolean(stale)}>
        <legend>{draft ? 'Seleção ainda não transmitida' : 'Seleção atual do placar'}</legend>
        <div className="scoreboard-selection-slots">{[0, 1].map((index) => {
          const id = value.gameIds[index]
          const game = games.find((item) => item.id === id)
          return <div className={id ? 'scoreboard-selection-slot is-selected' : 'scoreboard-selection-slot'} key={index}><span>PAINEL {index + 1}</span><strong>{game ? `${game.timeA} × ${game.timeB}` : id ? 'Partida indisponível' : index === 1 && value.gameIds.length === 1 ? 'O primeiro jogo ocupa a tela inteira' : 'Nenhum jogo selecionado'}</strong>{game ? <small>{game.esporteNome} · {matchVenueLabel(game) || shiftLabel(getGameShift(game))}</small> : null}{id ? <button className="btn btn-ghost btn-small" type="button" onClick={() => toggle(id)}>Remover do painel {index + 1}</button> : null}</div>
        })}</div>
        <div className="scoreboard-selection-filters"><label>Buscar partida<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Equipe, modalidade ou fase" /></label><label>Modalidade<select value={sport} onChange={(event) => setSport(event.target.value)}><option value="">Todas as modalidades</option>{getUniqueGameSports(eligible).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Turno<select value={turno} onChange={(event) => setTurno(event.target.value)}><option value="">Todos os turnos</option><option value="manha">Manhã</option><option value="tarde">Tarde</option></select></label></div>
        <div className="scoreboard-selection-options">{candidates.map((game) => <label className={value.gameIds.includes(game.id) ? 'scoreboard-selection-option is-selected' : 'scoreboard-selection-option'} key={game.id}><input type="checkbox" checked={value.gameIds.includes(game.id)} disabled={!value.gameIds.includes(game.id) && value.gameIds.length >= 2} onChange={() => toggle(game.id)} aria-label={`Transmitir ${game.esporteNome}: ${game.timeA} contra ${game.timeB}`} /><span><strong>{game.timeA} × {game.timeB}</strong><small>{game.esporteNome} · {formatDateTime(game.dataHora)} · {shiftLabel(getGameShift(game))}{game.venue ? ` · ${matchVenueLabel(game)}` : ''}</small></span><MatchBadge game={game} /></label>)}{!candidates.length ? <p className="scoreboard-selection-empty">{loading ? 'Carregando partidas…' : 'Nenhuma partida disponível neste filtro.'}</p> : null}</div>
        <p className="form-hint">{value.gameIds.length === 2 ? 'Dois jogos selecionados. Remova um para escolher outro.' : 'A escolha não inicia nem encerra partidas; ela define o que aparece na TV.'} Jogos encerrados continuam no placar até você trocar a seleção.</p>
        <div className="form-actions"><button type="submit" className="btn btn-primary">{busy ? 'Publicando…' : value.gameIds.length ? 'Transmitir seleção' : 'Colocar TV em espera'}</button><button type="button" className="btn btn-outline" onClick={() => { setDraft({ gameIds: [], revision: value.revision }); setMessage('') }} disabled={!value.gameIds.length}>Limpar seleção</button>{draft ? <button type="button" className="btn btn-ghost" onClick={() => { setDraft(null); setMessage('') }}>Descartar alterações</button> : null}<a className="btn btn-outline" href="/#placar" target="_blank" rel="noreferrer">Abrir placar da TV ↗</a></div>
      </fieldset>
    </form>
    {message ? <p className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{message}</p> : null}
  </section>
}
