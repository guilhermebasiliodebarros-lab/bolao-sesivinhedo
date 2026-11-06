import { useEffect, useRef, useState } from 'react'
import { loadMatchReport, recordLiveEvent, undoLiveEvent } from '../services/bolaoService.js'
import { getSportProfile } from '../utils/sportRules.js'
import { currentSetScore, eventIcon, eventMinute, isBasketball, scoreRevision } from '../utils/liveEvents.js'

export default function QuickScoring({ game, teams = [], disabled = false, expandedPlayers = false }) {
  const [source] = useState(() => ({ game, teams }))
  const [players, setPlayers] = useState({ A: [], B: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [points, setPoints] = useState(2)
  const [setReview, setSetReview] = useState(null)
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    loadMatchReport(source.game, source.teams).then((result) => { if (active) { setPlayers(Object.fromEntries(['A', 'B'].map((side) => [side, result.attendance?.[side]?.players?.filter((player) => player.status === 'present') || []]))); setLoading(false) } }).catch(() => { if (active) { setMessage('Não foi possível carregar os jogadores. Você pode registrar pontos sem autor e tentar reabrir o placar.'); setLoading(false) } })
    return () => { active = false }
  }, [source])
  const profile = getSportProfile(game)
  const isSets = profile.scoringMode === 'sets'
  const goal = profile.scoringMode === 'goals'
  const set = currentSetScore(game)
  const ended = isSets && Math.max(game.liveScoreA || 0, game.liveScoreB || 0) >= Math.ceil(profile.volleyballBestOf / 2)
  const blocked = busy || disabled || ended
  const act = async (operation) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setMessage('')
    try { await operation(); setSetReview(null) } catch (error) { setMessage(error.message) } finally { lock.current = false; setBusy(false) }
  }
  const score = (side, playerId = '') => act(() => recordLiveEvent({ gameId: game.id, requestId: crypto.randomUUID(), side, playerId, value: isBasketball(game) ? points : 1, expectedScoreRevision: scoreRevision(game) }))
  if (profile.scoringMode === 'chess') return null
  return <section className="quick-scoring" aria-label="Lançamento rápido de lances"><div className="quick-scoring-heading"><strong>{isSets ? `${set.number}º set · pontos` : 'Lançamento rápido'}</strong><span>{isSets ? `${set.a} × ${set.b} · sets ${game.liveScoreA || 0} × ${game.liveScoreB || 0}` : `${game.liveScoreA || 0} × ${game.liveScoreB || 0}`}</span></div>
    {isBasketball(game) ? <div className="quick-point-values" aria-label="Valor da cesta">{[1, 2, 3].map((value) => <button type="button" className={points === value ? 'is-active' : ''} aria-pressed={points === value} disabled={blocked} key={value} onClick={() => setPoints(value)}>+{value} ponto(s)</button>)}</div> : null}
    {!ended ? <div className="quick-team-columns">{['A', 'B'].map((side) => <div className="quick-team" key={side}><h4>{game[`time${side}`]}</h4><button type="button" className="quick-score-button" disabled={blocked} onClick={() => score(side)}>{goal ? '⚽ +1 gol' : `+${isBasketball(game) ? points : 1} ponto` }<small>Sem autor · equipe {side}</small></button><details open={expandedPlayers || undefined}><summary>Marcar por jogador ({players[side].length})</summary><div className="quick-player-buttons">{players[side].map((player) => <button type="button" disabled={blocked} key={player.id} onClick={() => score(side, player.id)} aria-label={`${goal ? 'Gol' : 'Ponto'} de ${player.nome} · equipe ${side}`}>{goal ? '⚽' : `+${isBasketball(game) ? points : 1}`} {player.nome}</button>)}</div>{!players[side].length ? <small>{loading ? 'Carregando jogadores…' : 'Nenhum jogador presente na conferência desta equipe.'}</small> : null}</details></div>)}</div> : <p className="alert alert-success">O placar de sets indica um vencedor. Confira e encerre a partida.</p>}
    <p className="quick-author-hint">Na TV aparece somente o primeiro nome. Use sem autor para ponto coletivo ou erro do adversário.</p>
    <div className="form-actions">{isSets && !ended ? <button type="button" className="btn btn-outline btn-small" disabled={blocked || set.a === set.b} onClick={() => setSetReview({ a: set.a, b: set.b, revision: scoreRevision(game) })}>Encerrar set</button> : null}<button type="button" className="btn btn-outline btn-small" disabled={busy || disabled || !game.lastScoreEventId} onClick={() => act(() => undoLiveEvent({ gameId: game.id, eventId: game.lastScoreEventId, expectedScoreRevision: scoreRevision(game) }))}>Desfazer último lance</button>{busy ? <span role="status">Registrando…</span> : null}</div>
    {setReview ? <div className="match-action-review"><strong>Confirmar set {setReview.a} × {setReview.b}?</strong><p>O vencedor recebe um set. Os pontos do próximo set começam em zero.</p><div className="form-actions"><button type="button" className="btn btn-primary btn-small" disabled={busy || scoreRevision(game) !== setReview.revision} onClick={() => act(() => recordLiveEvent({ gameId: game.id, requestId: crypto.randomUUID(), kind: 'set', expectedScoreRevision: setReview.revision }))}>Confirmar encerramento do set</button><button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={() => setSetReview(null)}>Voltar</button></div>{scoreRevision(game) !== setReview.revision ? <p>O placar mudou. Volte e confira o set atual.</p> : null}</div> : null}
    {game.liveEvents?.length ? <details className="quick-events"><summary>Últimos lances registrados</summary><ol>{[...game.liveEvents].reverse().map((event) => <li key={event.id}>{eventIcon(event)} {event.kind === 'set' ? `Set ${event.setNumber}: ${event.setScore.a} × ${event.setScore.b}` : `${event.playerName || 'Sem autor'} · ${game[`time${event.side}`]} · +${event.value}`} <small>{eventMinute(event)}</small></li>)}</ol></details> : null}
    {message ? <p className="alert alert-error" role="alert">{message}</p> : null}
  </section>
}
