import { useEffect, useRef, useState } from 'react'
import { getMatchState, getMatchCondition, MATCH_STATE } from '../utils/match.js'

export default function AdminGameActions({ game, prepared = false, saving, hasPredictions, onStart, onQuickStart, onManage, onEdit, onClosePredictions, onReopen, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const state = getMatchState(game)
  useEffect(() => {
    if (!open) return
    const outside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const act = (action) => { setOpen(false); action() }
  return <div className="admin-actions compact-game-actions">
    <button className="btn btn-primary btn-small" disabled={saving} onClick={() => state === MATCH_STATE.SCHEDULED ? prepared ? onQuickStart(game) : onStart(game) : onManage(game, state === MATCH_STATE.LIVE ? 'score' : state === MATCH_STATE.FINISHED ? 'report' : 'condition')}>{state === MATCH_STATE.SCHEDULED ? prepared ? 'Iniciar agora' : 'Preparar partida' : state === MATCH_STATE.LIVE ? 'Abrir placar' : state === MATCH_STATE.FINISHED ? 'Ver súmula' : 'Reagendar partida'}</button>
    <div className="game-actions-menu" ref={ref}><button className="btn btn-outline btn-small" aria-expanded={open} aria-label={`Mais opções · ${game.timeA} × ${game.timeB}`} disabled={saving} onClick={() => setOpen((current) => !current)}>Mais opções <span aria-hidden="true">⋮</span></button>
      {open ? <div className="game-actions-popover">{state === MATCH_STATE.SCHEDULED ? <button onClick={() => act(() => onStart(game))}>Revisar conferência</button> : null}<button onClick={() => act(() => onEdit(game))}>Editar jogo</button><button onClick={() => act(() => onManage(game, 'condition'))}>Situação da partida</button><button onClick={() => act(() => onManage(game, 'attendance'))}>Conferir presença</button><button onClick={() => act(() => onManage(game, 'report'))}>Súmula / PDF</button>{getMatchCondition(game) === 'normal' && game.status !== 'aberto' ? <button onClick={() => act(() => onManage(game, 'score'))}>{state === MATCH_STATE.FINISHED ? 'Corrigir resultado' : 'Lançar placar'}</button> : null}{game.status === 'aberto' ? <button onClick={() => act(() => onClosePredictions(game))}>Fechar palpites</button> : state !== MATCH_STATE.LIVE && !['postponed', 'cancelled'].includes(getMatchCondition(game)) ? <button onClick={() => act(() => onReopen(game))}>Reabrir palpites / resultado</button> : null}<button className="danger-action" disabled={hasPredictions || state === MATCH_STATE.LIVE} onClick={() => act(() => onDelete(game))}>Excluir jogo</button></div> : null}
    </div>
  </div>
}
