import { useState } from 'react'
import { startGame, updateLiveScore } from '../services/bolaoService.js'
import { formatDateTime } from '../utils/format.js'
import { matchesSport } from '../utils/game.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import MatchBadge from './MatchBadge.jsx'

export default function LiveControlPanel({ games, sports, onFinish, onNavigate, saving }) {
  const [sport, setSport] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const filtered = games.filter((game) => matchesSport(game, sport))
  const live = filtered.filter((game) => getMatchState(game) === MATCH_STATE.LIVE)
  const scheduled = filtered.filter((game) => getMatchState(game) === MATCH_STATE.SCHEDULED)
  const selected = scheduled.find((game) => game.id === selectedGame)
  const disabled = busy || saving

  const act = async (action, success) => {
    setBusy(true)
    setMessage('')
    setFailed(false)
    try { await action(); setMessage(success) }
    catch (error) { setFailed(true); setMessage(error.message) }
    finally { setBusy(false) }
  }
  const scores = (game) => ({ placarA: drafts[game.id]?.placarA ?? game.liveScoreA ?? 0, placarB: drafts[game.id]?.placarB ?? game.liveScoreB ?? 0 })
  const update = (game, field, value) => setDrafts((current) => ({ ...current, [game.id]: { ...current[game.id], [field]: value } }))

  return (
    <section className="live-control-panel" aria-label="Controle das partidas ao vivo">
      <div className="section-heading">
        <div><span className="eyebrow">Central de transmissão</span><h2>Ao vivo e modo TV</h2><p>Inicie partidas, atualize os placares e publique o resultado ao encerrar.</p></div>
        <button className="btn btn-outline" type="button" onClick={() => onNavigate('tv')}>Abrir modo TV</button>
      </div>
      <div className="live-start-panel">
        <label>Filtrar esporte<select value={sport} onChange={(event) => { setSport(event.target.value); setSelectedGame('') }}><option value="">Todos os esportes</option>{sports.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>
        <label>Partida para iniciar<select value={selected?.id || ''} onChange={(event) => setSelectedGame(event.target.value)} disabled={disabled}><option value="">Selecione uma partida</option>{scheduled.map((game) => <option value={game.id} key={game.id} disabled={Boolean(game.seedLabelA || game.seedLabelB)}>{game.esporteNome} · {game.timeA} × {game.timeB} · {formatDateTime(game.dataHora)}{game.seedLabelA || game.seedLabelB ? ' (participantes a definir)' : ''}</option>)}</select></label>
        <button className="btn btn-primary" type="button" disabled={!selected || disabled} onClick={() => act(async () => { await startGame(selected.id); setSelectedGame('') }, 'Partida iniciada. Palpites bloqueados e transmissão atualizada.')}>{busy ? 'Aguarde…' : 'Iniciar jogo'}</button>
        <p>Várias partidas podem ficar ao vivo ao mesmo tempo. O início bloqueia os palpites apenas do jogo selecionado.</p>
      </div>
      {message ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{message}</div> : null}
      <div className="section-heading"><h3>Partidas acontecendo agora</h3><span>{live.length} ao vivo</span></div>
      {live.length ? <div className="live-control-grid">{live.map((game) => (
        <article className="live-control-card" key={game.id}>
          <div className="section-heading"><span className="eyebrow">{game.esporteNome}</span><MatchBadge game={game} /></div>
          <h3>{game.timeA} × {game.timeB}</h3><p>{game.tournamentName || game.fase}</p>
          <form onSubmit={(event) => { event.preventDefault(); act(async () => { await updateLiveScore({ gameId: game.id, ...scores(game) }); setDrafts((current) => { const next = { ...current }; delete next[game.id]; return next }) }, 'Placar ao vivo atualizado na TV.') }}>
            <div className="live-score-inputs"><label>{game.timeA}<input type="number" min="0" step="1" required value={scores(game).placarA} disabled={disabled} onChange={(event) => update(game, 'placarA', event.target.value)} /></label><span>×</span><label>{game.timeB}<input type="number" min="0" step="1" required value={scores(game).placarB} disabled={disabled} onChange={(event) => update(game, 'placarB', event.target.value)} /></label></div>
            <div className="form-actions"><button className="btn btn-outline" type="submit" disabled={disabled}>Atualizar placar</button><button className="btn btn-primary" type="button" disabled={disabled} onClick={(event) => { if (event.currentTarget.form.reportValidity()) onFinish(game, scores(game)) }}>Encerrar partida</button></div>
          </form>
          <small>Encerrar confirma o placar final e recalcula a classificação do bolão.</small>
        </article>
      ))}</div> : <div className="live-control-empty"><strong>Nenhuma partida ao vivo neste filtro.</strong><p>Escolha uma partida acima e clique em Iniciar jogo.</p></div>}
    </section>
  )
}
