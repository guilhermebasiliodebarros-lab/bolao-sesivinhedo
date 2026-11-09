import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getMatchState, getMatchCondition, MATCH_STATE } from '../utils/match.js'

export default function AdminGameActions({ game, prepared = false, saving, hasPredictions, onStart, onQuickStart, onManage, onEdit, onClosePredictions, onReopen, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const menuRef = useRef(null)
  const state = getMatchState(game)
  useEffect(() => {
    if (!open) return
    const outside = (event) => { if (!ref.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  useLayoutEffect(() => {
    if (!open) return
    const menu = menuRef.current
    const place = () => {
      const anchor = ref.current.getBoundingClientRect()
      const size = menu.getBoundingClientRect()
      const below = window.innerHeight - anchor.bottom - 12
      const top = size.height <= below ? anchor.bottom + 6 : anchor.top - size.height - 6
      menu.style.left = `${Math.max(12, Math.min(anchor.right - size.width, document.documentElement.clientWidth - size.width - 12))}px`
      menu.style.top = `${Math.max(12, Math.min(top, window.innerHeight - size.height - 12))}px`
    }
    place()
    menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true })
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])
  const onMenuKeyDown = (event) => {
    const controls = [...menuRef.current.querySelectorAll('button:not(:disabled)')]
    if (event.key === 'Tab') {
      event.preventDefault()
      const trigger = ref.current.querySelector('button')
      const available = [...document.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((item) => item.getClientRects().length && !menuRef.current.contains(item))
      const next = available[available.indexOf(trigger) + (event.shiftKey ? -1 : 1)] || trigger
      setOpen(false); next.focus()
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const index = controls.indexOf(document.activeElement)
      controls[event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length]?.focus()
    }
  }
  const act = (action) => { setOpen(false); ref.current?.querySelector('button')?.focus({ preventScroll: true }); action() }
  return <div className="admin-actions compact-game-actions">
    <button className="btn btn-primary btn-small" disabled={saving} onClick={() => state === MATCH_STATE.SCHEDULED ? prepared ? onQuickStart(game) : onStart(game) : onManage(game, state === MATCH_STATE.LIVE ? 'score' : state === MATCH_STATE.FINISHED ? 'report' : 'condition')}>{state === MATCH_STATE.SCHEDULED ? prepared ? 'Iniciar agora' : 'Preparar partida' : state === MATCH_STATE.LIVE ? 'Abrir placar' : state === MATCH_STATE.FINISHED ? 'Ver súmula' : 'Reagendar partida'}</button>
    <div className="game-actions-menu" ref={ref}><button className="btn btn-outline btn-small" aria-expanded={open} aria-label={`Mais opções · ${game.timeA} × ${game.timeB}`} disabled={saving} onClick={() => setOpen((current) => !current)}>Mais opções <span aria-hidden="true">⋮</span></button>
      {open ? createPortal(<div ref={menuRef} className="game-actions-popover" role="group" aria-label="Mais ações da partida" onKeyDown={onMenuKeyDown}>{state === MATCH_STATE.LIVE ? <button onClick={() => act(() => onManage(game, 'referee'))}>Modo árbitro</button> : null}{state === MATCH_STATE.SCHEDULED ? <button onClick={() => act(() => onStart(game))}>Revisar conferência</button> : null}<button onClick={() => act(() => onEdit(game))}>Editar jogo</button><button onClick={() => act(() => onManage(game, 'condition'))}>Situação da partida</button><button onClick={() => act(() => onManage(game, 'attendance'))}>Conferir presença</button><button onClick={() => act(() => onManage(game, 'report'))}>Súmula / PDF</button>{getMatchCondition(game) === 'normal' && game.status !== 'aberto' ? <button onClick={() => act(() => onManage(game, 'score'))}>{state === MATCH_STATE.FINISHED ? 'Corrigir resultado' : 'Lançar placar'}</button> : null}{game.status === 'aberto' ? <button onClick={() => act(() => onClosePredictions(game))}>Fechar palpites</button> : state !== MATCH_STATE.LIVE && !['postponed', 'cancelled'].includes(getMatchCondition(game)) ? <button onClick={() => act(() => onReopen(game))}>Reabrir palpites / resultado</button> : null}<button className="danger-action" disabled={hasPredictions || state === MATCH_STATE.LIVE} onClick={() => act(() => onDelete(game))}>Excluir jogo</button></div>, document.body) : null}
    </div>
  </div>
}
