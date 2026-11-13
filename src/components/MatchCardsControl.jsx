import { useRef, useState } from 'react'
import { useMatchOperations } from '../context/useMatchOperations.js'
import { useAuth } from '../context/useAuth.js'
import { eventMinute } from '../utils/liveEvents.js'
import './MatchOperationTools.css'

export default function MatchCardsControl({ game, teams, players, disabled }) {
  const { resolveDisciplinaryRecord, saveDisciplinaryRecord } = useMatchOperations()
  const { user } = useAuth()
  const [draft, setDraft] = useState({ side: 'A', playerId: '', type: 'yellow', minute: '', reason: '' })
  const [review, setReview] = useState(false)
  const [voiding, setVoiding] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const lock = useRef(false)
  const teamId = (side) => game[`teamId${side}`] || teams.find((team) => team.sportId === game.sportId && team.nome === game[`time${side}`])?.id
  const player = players[draft.side]?.find((item) => item.id === draft.playerId)
  const update = (field, value) => { setReview(false); setDraft((current) => ({ ...current, [field]: value, ...(field === 'side' ? { playerId: '' } : {}) })) }
  const act = async (operation, success) => {
    if (lock.current || disabled) return
    lock.current = true; setBusy(true); setMessage(''); setFailed(false)
    try { await operation(); setMessage(success); setReview(false); setVoiding(null); setReason('') } catch (failure) { setMessage(failure.message); setFailed(true) } finally { lock.current = false; setBusy(false) }
  }
  return <section className="match-cards-control" aria-label="Cartões da partida">
    <div className="section-heading"><div><span className="eyebrow">Arbitragem</span><h4>Cartões da partida</h4></div><span className="match-card-swatches" aria-hidden="true">🟨 🟥</span></div>
    <form onSubmit={(event) => {
      event.preventDefault()
      if (!player) return
      if (!review) { setMessage(''); setReview(true); return }
      act(async () => {
        await saveDisciplinaryRecord(teamId(draft.side), { ...draft, gameId: game.id, reason: draft.reason.trim() || `${draft.type === 'yellow' ? 'Cartão amarelo' : 'Cartão vermelho'} registrado pela arbitragem.` }, user)
        setDraft((current) => ({ ...current, playerId: '', minute: '', reason: '' }))
      }, 'Cartão registrado. TV e Central disciplinar atualizadas.')
    }}>
      <fieldset disabled={disabled || busy || review || Boolean(voiding)}><legend className="sr-only">Registrar cartão</legend><div className="match-tools-grid">
        <label>Equipe do cartão<select value={draft.side} onChange={(event) => update('side', event.target.value)}>{['A', 'B'].map((side) => <option key={side} value={side}>{game[`time${side}`]}</option>)}</select></label>
        <label>Aluno do cartão<select required value={player ? draft.playerId : ''} onChange={(event) => update('playerId', event.target.value)}><option value="">Selecione o aluno</option>{(players[draft.side] || []).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
        <label>Cor do cartão<select value={draft.type} onChange={(event) => update('type', event.target.value)}><option value="yellow">Amarelo</option><option value="red">Vermelho</option></select></label>
        <label>Minuto do cartão<input type="number" min="0" max="999" step="1" placeholder="Automático" value={draft.minute} onChange={(event) => update('minute', event.target.value)} /></label>
      </div><label>Observação da arbitragem (opcional)<input type="text" minLength="3" maxLength="1000" value={draft.reason} onChange={(event) => update('reason', event.target.value)} /></label></fieldset>
      {review ? <div className="match-action-review"><strong>{draft.type === 'yellow' ? '🟨 Amarelo' : '🟥 Vermelho'} para {player?.nome} · {game[`time${draft.side}`]}</strong><p>{draft.minute !== '' ? `Minuto ${draft.minute}′` : 'O minuto será registrado pelo cronômetro ao confirmar.'}</p></div> : null}
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={disabled || busy || !player || Boolean(voiding)}>{busy ? 'Registrando…' : review ? 'Confirmar cartão' : 'Revisar cartão'}</button>{review ? <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setReview(false)}>Voltar</button> : null}</div>
    </form>
    {message ? <p className={`alert ${failed ? 'alert-error' : 'alert-success'}`} role={failed ? 'alert' : 'status'}>{message}</p> : null}
    <div className="match-cards-list">{[...(game.publicCardEvents || [])].reverse().map((card) => <div key={card.id}><span>{card.kind === 'red' ? '🟥' : '🟨'} <strong>{card.playerName}</strong> · {game[`time${card.side}`]}{card.elapsedMs != null ? ` · ${eventMinute(card)}` : ''}</span><button type="button" className="btn btn-outline btn-small" disabled={disabled || busy || review} onClick={() => { setVoiding(card); setReason(''); setMessage('') }}>Anular cartão</button></div>)}</div>
    {voiding ? <div className="match-action-review"><strong>Anular cartão de {voiding.playerName}?</strong><label>Motivo da anulação<input type="text" minLength="3" maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="form-actions"><button type="button" className="btn btn-primary" disabled={disabled || busy || reason.trim().length < 3} onClick={() => act(() => resolveDisciplinaryRecord({ teamId: teamId(voiding.side), recordId: voiding.id, status: 'void', expectedRevision: 1, reason, user }), 'Cartão anulado. TV e histórico atualizados.')}>Confirmar anulação do cartão</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setVoiding(null)}>Cancelar</button></div></div> : null}
  </section>
}
