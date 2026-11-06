import { useState } from 'react'
import { finalizeGame, updateLiveScore } from '../services/bolaoService.js'
import { getMatchState, getMatchCondition, MATCH_STATE } from '../utils/match.js'
import { normalizeTieBreak, tieBreakSummary } from '../utils/tieBreak.js'
import { validateSportScores } from '../utils/sportRules.js'
import SportScoreInputs from './SportScoreInputs.jsx'
import TieBreakInputs from './TieBreakInputs.jsx'
import MatchClockControl from './MatchClock.jsx'
import QuickScoring from './QuickScoring.jsx'
import { scoreRevision } from '../utils/liveEvents.js'
import { getSportProfile } from '../utils/sportRules.js'

export default function MatchScoreForm({ game, teams, user, onSaved, referee = false }) {
  const live = getMatchState(game) === MATCH_STATE.LIVE
  const [draft, setDraft] = useState(null)
  const value = draft || { placarA: (live ? game.liveScoreA : game.placarA) ?? 0, placarB: (live ? game.liveScoreB : game.placarB) ?? 0, setScores: game.setScores || [], currentSet: game.currentSet || { a: 0, b: 0 }, tieBreak: game.tieBreak, expectedScoreRevision: scoreRevision(game) }
  const stale = value.expectedScoreRevision !== scoreRevision(game)
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const update = (field, next) => setDraft((current) => ({ ...(current || value), [field]: next }))
  if (getMatchCondition(game) !== 'normal' || game.status === 'aberto') return <p className="alert">Inicie a partida pela conferência para lançar o placar. Para tratar W.O., adiamento ou cancelamento, use Situação da partida.</p>
  return <>{live ? <><MatchClockControl game={game} disabled={busy || review} /><QuickScoring game={game} teams={teams} disabled={busy || review} expandedPlayers={referee} /></> : null}<form className="match-score-form" onSubmit={async (event) => {
    event.preventDefault(); setMessage('')
    if (!live && !review) { setReview(true); return }
    setBusy(true)
    try {
      if (review) { await finalizeGame({ gameId: game.id, ...value, user }); onSaved('Resultado salvo e classificação atualizada.') }
      else { await updateLiveScore({ gameId: game.id, ...value }); setDraft(null); setMessage('Placar ao vivo atualizado na TV.') }
    } catch (error) { setMessage(error.message); setReview(false) } finally { setBusy(false) }
  }}><details className="score-manual-editor" open={!live || (referee && getSportProfile(game).scoringMode === 'chess') || undefined}><summary>Correção manual do placar e parciais</summary><p>Alterar o placar manualmente reinicia os lances e autores exibidos na TV.</p><fieldset disabled={busy || review}><legend>{live ? 'Placar ao vivo' : 'Resultado final'}</legend><SportScoreInputs game={game} value={value} onChange={update} /><TieBreakInputs game={game} value={value} onChange={(tie) => update('tieBreak', tie)} /></fieldset></details>
    {stale ? <div className="schedule-warning">O placar foi atualizado. Confira os valores antes de salvar.<button type="button" className="btn btn-outline btn-small" onClick={() => { setDraft(null); setReview(false) }}>Usar placar atual</button></div> : null}
    {review ? <div className="match-action-review"><strong>Confirmar {game.timeA} {value.placarA} × {value.placarB} {game.timeB}?</strong>{value.tieBreak?.method && value.tieBreak.method !== 'none' ? <p>{tieBreakSummary({ tieBreak: value.tieBreak })}</p> : null}<p>O resultado será publicado e os palpites serão pontuados pelo placar do tempo normal.</p></div> : null}
    {message ? <div className="alert" role="status">{message}</div> : null}
    <div className="form-actions">{review ? <button className="btn btn-outline" type="button" disabled={busy} onClick={() => setReview(false)}>Voltar e revisar</button> : null}<button className="btn btn-primary" type="submit" disabled={busy || stale}>{busy ? 'Salvando…' : review ? 'Confirmar resultado' : live ? 'Salvar correção manual' : 'Revisar resultado'}</button>{live && !review ? <button className="btn btn-outline" type="button" disabled={busy || stale} onClick={(event) => {
      if (!event.currentTarget.form.reportValidity()) return
      try { validateSportScores(game, value.placarA, value.placarB, { final: true }); normalizeTieBreak(game, value.tieBreak, value.placarA, value.placarB, { final: true }); setDraft({ ...value }); setReview(true); setMessage('') } catch (error) { setMessage(error.message) }
    }}>Encerrar partida</button> : null}</div>
  </form></>
}
