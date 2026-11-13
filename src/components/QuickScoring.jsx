import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { correctLiveEvent, loadMatchReport, recordLiveEvent, undoLiveEvent } from '../services/bolaoService.js'
import { getSportProfile } from '../utils/sportRules.js'
import { canCorrectLiveEvent, currentSetScore, eventIcon, eventMinute, isBasketball, scoreRevision } from '../utils/liveEvents.js'
import { getMatchCondition, getMatchState, MATCH_STATE } from '../utils/match.js'
import { attendanceTeamKey } from '../utils/attendance.js'
import { useAuth } from '../context/useAuth.js'
import './QuickScoring.css'
import MatchCardsControl from './MatchCardsControl.jsx'

const requestId = () => globalThis.crypto?.randomUUID?.() || `live-${Date.now().toString(36)}-${Array.from(globalThis.crypto.getRandomValues(new Uint32Array(3)), (value) => value.toString(36)).join('-')}`
const amountLabel = (value, goal = false) => `${value} ${goal ? value === 1 ? 'gol' : 'gols' : value === 1 ? 'ponto' : 'pontos'}`

export default function QuickScoring({ game, teams = [], disabled = false, expandedPlayers = false }) {
  const { user } = useAuth()
  const [playersFeed, setPlayersFeed] = useState(null)
  const [reload, setReload] = useState(0)
  const [authors, setAuthors] = useState({ A: '', B: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine !== false)
  const [points, setPoints] = useState(2)
  const [setReview, setSetReview] = useState(null)
  const [correction, setCorrection] = useState(null)
  const lock = useRef(false)
  const profile = getSportProfile(game)
  const chess = profile.scoringMode === 'chess'
  const attendanceStamp = game.attendanceSummary?.checkedAt?.toMillis?.() ?? game.attendanceSummary?.checkedAt ?? ''
  const rosterKey = JSON.stringify([attendanceTeamKey(game), attendanceStamp, teams.filter((team) => [game.teamIdA, game.teamIdB].includes(team.id) || (team.sportId === game.sportId && [game.timeA, game.timeB].includes(team.nome))).map((team) => [team.id, team.playerCount])])
  const readPlayers = useEffectEvent(() => loadMatchReport(game, teams))
  useEffect(() => {
    if (chess) return
    let active = true
    readPlayers().then((result) => {
      if (active) setPlayersFeed({ key: rosterKey, players: Object.fromEntries(['A', 'B'].map((side) => [side, result.attendance?.[side]?.players?.filter((player) => player.status === 'present') || []])), cardPlayers: { A: result.playersA, B: result.playersB }, error: '' })
    }).catch(() => { if (active) setPlayersFeed({ key: rosterKey, players: { A: [], B: [] }, error: 'Não foi possível carregar os alunos. Atualize a lista ou registre sem autor.' }) })
    return () => { active = false }
  }, [chess, rosterKey, reload])
  useEffect(() => {
    const network = () => setOnline(navigator.onLine !== false)
    window.addEventListener('online', network); window.addEventListener('offline', network)
    return () => { window.removeEventListener('online', network); window.removeEventListener('offline', network) }
  }, [])
  const feed = playersFeed?.key === rosterKey ? playersFeed : null
  const players = feed?.players || { A: [], B: [] }
  const loading = !feed
  const isSets = profile.scoringMode === 'sets'
  const goal = profile.scoringMode === 'goals'
  const interval = game.period?.phase === 'interval'
  const set = currentSetScore(game)
  const ended = isSets && Math.max(game.liveScoreA || 0, game.liveScoreB || 0) >= Math.ceil(profile.volleyballBestOf / 2)
  const available = online && getMatchState(game) === MATCH_STATE.LIVE && getMatchCondition(game) === 'normal' && !game.deletionPending
  const blocked = busy || disabled || !available || ended || Boolean(correction) || Boolean(setReview)
  const recent = [...(game.liveEvents || [])].reverse()
  const last = recent[0]
  const act = async (operation, success) => {
    if (lock.current || disabled || !available) return
    lock.current = true; setBusy(true); setMessage(''); setFailed(false)
    try { await operation(); setSetReview(null); setCorrection(null); setMessage(success) } catch (error) { setFailed(true); setMessage(error.message) } finally { lock.current = false; setBusy(false) }
  }
  const score = (side, playerId = '') => {
    if (blocked || interval) return
    const author = players[side].find((player) => player.id === playerId)
    act(() => recordLiveEvent({ gameId: game.id, requestId: requestId(), side, playerId, value: isBasketball(game) ? points : 1, expectedScoreRevision: scoreRevision(game) }), `${goal ? 'Gol' : 'Ponto'} ${author ? `de ${author.nome} ` : ''}registrado para ${game[`time${side}`]}.`)
  }
  const remove = (event) => act(() => correctLiveEvent({ gameId: game.id, eventId: event.id, requestId: requestId(), action: 'remove', expectedScoreRevision: scoreRevision(game), user }), `Lance de ${game[`time${event.side}`]} excluído. Placar e autoria atualizados.`)
  const reviewTransfer = (event) => setCorrection({ event, side: event.side === 'A' ? 'B' : 'A', playerId: '', revision: scoreRevision(game) })
  if (chess) return null
  return <section className="quick-scoring" aria-label="Lançamento rápido de lances" aria-busy={busy}>
    <div className="quick-scoring-heading"><strong>{isSets ? ended ? 'Sets encerrados' : `${set.number}º set · pontos` : 'Gols e pontos ao vivo'}</strong><span>{isSets ? `${set.a} × ${set.b} · sets ${game.liveScoreA || 0} × ${game.liveScoreB || 0}` : `${game.liveScoreA || 0} × ${game.liveScoreB || 0}`}</span></div>
    <p className="quick-author-hint">Escolha o aluno e toque no botão da equipe. Os botões com nomes registram o lance em um toque.</p>
    {!online ? <p className="alert alert-error" role="status">Sem internet. Aguarde a conexão voltar antes de lançar ou corrigir pontos.</p> : null}
    {interval ? <p className="schedule-warning" role="status">Intervalo. Inicie o próximo período antes de lançar gols ou pontos. As correções e os cartões continuam disponíveis.</p> : null}
    {isBasketball(game) ? <div className="quick-point-values" aria-label="Valor da cesta">{[1, 2, 3].map((value) => <button type="button" className={points === value ? 'is-active' : ''} aria-pressed={points === value} disabled={blocked} key={value} onClick={() => setPoints(value)}>+{amountLabel(value)}</button>)}</div> : null}
    {!ended ? <div className="quick-team-columns">{['A', 'B'].map((side) => {
      const chosen = players[side].find((player) => player.id === authors[side])
      const invalidAuthor = Boolean(authors[side]) && !chosen
      const removable = recent.find((event) => event.side === side && canCorrectLiveEvent(game, event))
      return <div className={`quick-team quick-team-${side}`} key={side}>
        <div className="quick-team-score"><h4>{game[`time${side}`]}</h4><strong>{isSets ? set[side.toLowerCase()] : game[`liveScore${side}`] || 0}</strong></div>
        <label>Quem marcou para {game[`time${side}`]}?<select value={authors[side]} disabled={blocked || loading} onChange={(event) => setAuthors((current) => ({ ...current, [side]: event.target.value }))}>{invalidAuthor ? <option value={authors[side]} disabled>Autor indisponível · escolha outro</option> : null}<option value="">Sem autor / ponto coletivo</option>{players[side].map((player) => <option key={player.id} value={player.id}>{player.nome}</option>)}</select></label>
        <button type="button" className="quick-score-button" disabled={blocked || interval || invalidAuthor} onClick={() => score(side, chosen?.id || '')} aria-label={`Adicionar ${goal ? 'gol' : amountLabel(isBasketball(game) ? points : 1)} para ${game[`time${side}`]}`}><span>{goal ? '⚽ +1 GOL' : `+${isBasketball(game) ? points : 1} PONTO${isBasketball(game) && points > 1 ? 'S' : ''}`}</span><small>{chosen?.nome || 'Sem autor'} · {game[`time${side}`]}</small></button>
        {invalidAuthor && !loading ? <small role="status">O aluno selecionado não está mais na lista de presentes. Escolha outro autor ou Sem autor.</small> : null}
        <button type="button" className="quick-remove-score" disabled={blocked || !removable} title={removable ? `Excluir lance de ${removable.playerName || 'sem autor'}` : 'Sem lance recente disponível para excluir nesta equipe'} onClick={() => remove(removable)} aria-label={`Excluir último ${goal ? 'gol' : 'lance de ponto'} de ${game[`time${side}`]}`}>{goal ? '− Excluir gol' : `− Excluir ${amountLabel(removable?.value || 1)}`}</button>
        <details open={expandedPlayers || undefined}><summary>Marcar por jogador ({players[side].length})</summary><div className="quick-player-buttons">{players[side].map((player) => <button type="button" disabled={blocked || interval} key={player.id} onClick={() => score(side, player.id)} aria-label={`${goal ? 'Gol' : 'Ponto'} de ${player.nome} · equipe ${side}`}>{goal ? '⚽' : `+${isBasketball(game) ? points : 1}`} {player.nome}</button>)}</div>{!players[side].length ? <small>{loading ? 'Carregando jogadores…' : 'Nenhum jogador presente na conferência desta equipe.'}</small> : null}</details>
      </div>
    })}</div> : <p className="alert alert-success">O placar de sets indica um vencedor. Confira e encerre a partida.</p>}
    <div className="quick-roster-actions"><small>Na TV aparece só o primeiro nome. Sem autor pode ser usado para ponto coletivo ou erro do adversário.</small><button type="button" className="btn btn-outline btn-small" disabled={busy || loading} onClick={() => { setPlayersFeed(null); setReload((value) => value + 1) }}>Atualizar alunos</button></div>
    <MatchCardsControl game={game} teams={teams} players={feed?.cardPlayers || players} disabled={busy || disabled || !available || loading || Boolean(correction) || Boolean(setReview)} />
    {feed?.error ? <p className="alert alert-error" role="status">{feed.error}</p> : null}
    {last ? <div className="quick-last-event"><span>Último lance</span><strong>{last.kind === 'set' ? `Set ${last.setNumber} encerrado: ${last.setScore.a} × ${last.setScore.b}` : `${last.playerName || 'Sem autor'} · ${game[`time${last.side}`]} · +${amountLabel(last.value, goal)}`}</strong><div className="form-actions"><button type="button" className="btn btn-outline" disabled={blocked || !canCorrectLiveEvent(game, last)} onClick={() => reviewTransfer(last)}>Equipe errada? Corrigir</button><button type="button" className="btn btn-outline" disabled={busy || disabled || !available || Boolean(correction) || Boolean(setReview) || !game.lastScoreEventId} onClick={() => act(() => undoLiveEvent({ gameId: game.id, eventId: game.lastScoreEventId, expectedScoreRevision: scoreRevision(game) }), 'Último lance desfeito. Placar e autoria atualizados.')}>Desfazer último lance</button></div></div> : null}
    <div className="form-actions">{isSets && !ended ? <button type="button" className="btn btn-outline" disabled={blocked || set.a === set.b} onClick={() => setSetReview({ a: set.a, b: set.b, revision: scoreRevision(game) })}>Encerrar set</button> : null}{busy ? <span role="status">Atualizando placar…</span> : null}</div>
    {setReview ? <div className="match-action-review"><strong>Confirmar set {setReview.a} × {setReview.b}?</strong><p>O vencedor recebe um set. Os pontos do próximo set começam em zero.</p><div className="form-actions"><button type="button" className="btn btn-primary btn-small" disabled={busy || disabled || !available || scoreRevision(game) !== setReview.revision} onClick={() => act(() => recordLiveEvent({ gameId: game.id, requestId: requestId(), kind: 'set', expectedScoreRevision: setReview.revision }), 'Set encerrado. Os pontos do próximo set começam em zero.')}>Confirmar encerramento do set</button><button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={() => setSetReview(null)}>Voltar</button></div>{scoreRevision(game) !== setReview.revision ? <p>O placar mudou. Volte e confira o set atual.</p> : null}</div> : null}
    {correction ? <div className="match-action-review quick-transfer-review" role="region" aria-label="Corrigir equipe do lance"><strong>Mover {amountLabel(correction.event.value, goal)} de {game[`time${correction.event.side}`]} para {game[`time${correction.side}`]}?</strong><p>O lance será retirado da equipe errada e contará para a equipe escolhida. Selecione o aluno correto ou deixe sem autor.</p><label>Autor na equipe {game[`time${correction.side}`]}<select value={correction.playerId} disabled={busy || loading} onChange={(event) => setCorrection((current) => ({ ...current, playerId: event.target.value }))}><option value="">Sem autor / ponto coletivo</option>{players[correction.side].map((player) => <option key={player.id} value={player.id}>{player.nome}</option>)}</select></label><div className="form-actions"><button type="button" className="btn btn-primary" disabled={busy || disabled || !available || scoreRevision(game) !== correction.revision || (Boolean(correction.playerId) && !players[correction.side].some((player) => player.id === correction.playerId))} onClick={() => act(() => correctLiveEvent({ gameId: game.id, eventId: correction.event.id, requestId: requestId(), action: 'transfer', playerId: correction.playerId, expectedScoreRevision: correction.revision, user }), `Lance corrigido para ${game[`time${correction.side}`]}. Placar e autoria atualizados.`)}>Confirmar equipe correta</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setCorrection(null)}>Cancelar correção</button></div>{scoreRevision(game) !== correction.revision ? <p role="status">O placar mudou em outro lançamento. Cancele e confira o lance novamente.</p> : null}</div> : null}
    {recent.length ? <details className="quick-events"><summary>Lances recentes · excluir ou corrigir equipe</summary><ol>{recent.map((event, index) => <li key={event.id}><div><strong>{eventIcon(event)} {event.kind === 'set' ? `Set ${event.setNumber}: ${event.setScore.a} × ${event.setScore.b}` : `${event.playerName || 'Sem autor'} · ${game[`time${event.side}`]} · +${event.value}`}</strong><small>{eventMinute(event)}{event.setNumber ? ` · ${event.setNumber}º set` : ''}{event.correctionRevision ? ' · equipe corrigida' : ''}</small></div>{canCorrectLiveEvent(game, event) ? <div className="form-actions"><button type="button" className="btn btn-outline btn-small" disabled={blocked} onClick={() => remove(event)} aria-label={`Excluir lance ${index + 1} de ${game[`time${event.side}`]}`}>Excluir</button><button type="button" className="btn btn-outline btn-small" disabled={blocked} onClick={() => reviewTransfer(event)} aria-label={`Corrigir equipe do lance ${index + 1}`}>Corrigir equipe</button></div> : null}</li>)}</ol><p>No vôlei, os botões corrigem pontos do set em andamento. Para reabrir um set recém-encerrado, use Desfazer último lance.</p></details> : null}
    {message ? <p className={`alert ${failed ? 'alert-error' : 'alert-success'}`} role={failed ? 'alert' : 'status'}>{message}</p> : null}
  </section>
}
