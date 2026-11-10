import { useState } from 'react'
import { updateLiveScore } from '../services/bolaoService.js'
import { formatDateTime } from '../utils/format.js'
import { matchesSport } from '../utils/game.js'
import { getMatchState, MATCH_STATE } from '../utils/match.js'
import MatchBadge from './MatchBadge.jsx'
import MatchClockControl from './MatchClock.jsx'
import QuickScoring from './QuickScoring.jsx'
import { scoreRevision } from '../utils/liveEvents.js'
import SportScoreInputs from './SportScoreInputs.jsx'
import MatchDetails from './MatchDetails.jsx'
import TieBreakInputs from './TieBreakInputs.jsx'
import { hasConfirmedTeams } from '../utils/attendance.js'
import PreparedMatches from './PreparedMatches.jsx'
import { liveStartConflicts } from '../utils/matchStart.js'

export default function LiveControlPanel({ games, conflictGames = games, teams, sports, onFinish, onNavigate, saving, onManage, onStart }) {
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
  const scores = (game) => ({ placarA: drafts[game.id]?.placarA ?? game.liveScoreA ?? 0, placarB: drafts[game.id]?.placarB ?? game.liveScoreB ?? 0, setScores: drafts[game.id]?.setScores ?? game.setScores ?? [], currentSet: drafts[game.id]?.currentSet ?? game.currentSet ?? { a: 0, b: 0 }, tieBreak: drafts[game.id]?.tieBreak ?? game.tieBreak, expectedScoreRevision: drafts[game.id]?.expectedScoreRevision ?? scoreRevision(game) })
  const update = (game, field, value) => setDrafts((current) => ({ ...current, [game.id]: { ...scores(game), ...current[game.id], [field]: value } }))

  return (
    <section className="live-control-panel" aria-label="Controle das partidas ao vivo">
      <div className="section-heading">
        <div><span className="eyebrow">Central de transmissão</span><h2>Ao vivo e modo TV</h2><p>Inicie partidas, atualize os placares e publique o resultado ao encerrar.</p></div>
        <button className="btn btn-outline" type="button" onClick={() => onNavigate('tv')}>Abrir modo TV</button>
      </div>
      <PreparedMatches games={games} teams={teams} disabled={disabled} sport={sport} />
      <div className="live-start-panel">
        <label>Filtrar esporte<select value={sport} onChange={(event) => { setSport(event.target.value); setSelectedGame('') }}><option value="">Todos os esportes</option>{sports.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>
        <label>Partida para iniciar<select value={selected?.id || ''} onChange={(event) => setSelectedGame(event.target.value)} disabled={disabled}><option value="">Selecione uma partida</option>{scheduled.map((game) => <option value={game.id} key={game.id} disabled={Boolean(game.seedLabelA || game.seedLabelB)}>{game.esporteNome} · {game.timeA} × {game.timeB} · {formatDateTime(game.dataHora)}{game.seedLabelA || game.seedLabelB ? ' (participantes a definir)' : ''}</option>)}</select></label>
        <button className="btn btn-primary" type="button" disabled={!selected || disabled} onClick={() => onStart(selected)}>Preparar partida</button>
        <p>Várias partidas podem ficar ao vivo ao mesmo tempo. O início bloqueia os palpites apenas do jogo selecionado.</p>
      </div>
      {selected ? <div className="selected-match-details"><MatchDetails game={selected} /><div className={hasConfirmedTeams(selected) ? 'alert alert-success' : 'schedule-warning'}>{hasConfirmedTeams(selected) ? 'Presença das duas equipes confirmada.' : 'Confira a presença, os coletes e a área ao preparar a partida.'}</div>{liveStartConflicts(selected, conflictGames).length ? <p className="schedule-warning" role="status">Há uma partida ao vivo nesta área ou com uma destas equipes. Você pode preparar agora e iniciar quando liberar.</p> : null}</div> : null}
      {message ? <div className={failed ? 'alert alert-error' : 'alert alert-success'} role={failed ? 'alert' : 'status'}>{message}</div> : null}
      <div className="section-heading"><h3>Partidas acontecendo agora</h3><span>{live.length} ao vivo</span></div>
      {live.length ? <div className="live-control-grid">{live.map((game) => (
        <article className="live-control-card" key={game.id}>
          <div className="section-heading"><span className="eyebrow">{game.esporteNome}</span><MatchBadge game={game} /></div>
          <h3>{game.timeA} × {game.timeB}</h3><p>{game.tournamentName || game.fase}</p>
          <MatchDetails game={game} />
          <button type="button" className="btn btn-primary referee-open-button" disabled={disabled} onClick={() => onManage(game, 'referee')}>Abrir modo árbitro</button>
          <MatchClockControl game={game} disabled={disabled} />
          <QuickScoring game={game} teams={teams} disabled={disabled} expandedPlayers />
          {scores(game).expectedScoreRevision !== scoreRevision(game) ? <p className="schedule-warning">O placar mudou. <button type="button" className="btn btn-outline btn-small" onClick={() => setDrafts((current) => { const next = { ...current }; delete next[game.id]; return next })}>Usar placar atual</button></p> : null}
          <form onSubmit={(event) => { event.preventDefault(); act(async () => { await updateLiveScore({ gameId: game.id, ...scores(game) }); setDrafts((current) => { const next = { ...current }; delete next[game.id]; return next }) }, 'Placar atualizado em todas as telas.') }}>
            <details className="score-manual-editor"><summary>Correção manual do placar e parciais</summary><p>Alterar o placar manualmente reinicia os lances e autores exibidos na TV.</p><SportScoreInputs game={game} value={scores(game)} disabled={disabled} onChange={(field, value) => update(game, field, value)} /><TieBreakInputs game={game} value={scores(game)} disabled={disabled} onChange={(value) => update(game, 'tieBreak', value)} /><button className="btn btn-outline" type="submit" disabled={disabled || scores(game).expectedScoreRevision !== scoreRevision(game)}>Salvar correção manual</button></details>
            <div className="form-actions"><button className="btn btn-primary" type="button" disabled={disabled || scores(game).expectedScoreRevision !== scoreRevision(game)} onClick={(event) => { if (event.currentTarget.form.reportValidity()) onFinish(game, scores(game)) }}>Encerrar partida</button></div>
          </form>
          <small>Encerrar confirma o placar final e recalcula a classificação do bolão.</small>
          <div className="form-actions"><button type="button" className="btn btn-outline btn-small" disabled={disabled} onClick={() => onManage(game, 'condition')}>Situação da partida</button><button type="button" className="btn btn-outline btn-small" disabled={disabled} onClick={() => onManage(game, 'attendance')}>Presença</button><button type="button" className="btn btn-outline btn-small" disabled={disabled} onClick={() => onManage(game, 'report')}>Súmula / PDF</button></div>
        </article>
      ))}</div> : <div className="live-control-empty"><strong>Nenhuma partida ao vivo neste filtro.</strong><p>Escolha uma partida acima e clique em Iniciar jogo.</p></div>}
    </section>
  )
}
