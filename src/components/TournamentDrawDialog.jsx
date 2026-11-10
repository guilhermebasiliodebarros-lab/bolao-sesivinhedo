import { useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createDrawPresentation, drawFingerprint, drawPresentationReducer, drawRevealOrder, drawSections } from '../utils/tournamentDraw.js'
import useModalDialog from '../hooks/useModalDialog.js'
import './TournamentDrawDialog.css'

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(Boolean(query?.matches))
    query?.addEventListener('change', change)
    return () => query?.removeEventListener('change', change)
  }, [])
  return reduced
}

const EJECTION_DURATION = 900
const OPENING_DURATION = 3250
const READING_DURATION = 2250
const FLIGHT_DURATION = 2750

function readMotionPreference() {
  try {
    const value = localStorage.getItem('bolao-draw-motion')
    if (['full', 'system', 'reduced'].includes(value)) return value
  } catch { /* The presentation also works when storage is unavailable. */ }
  return 'full'
}

function TeamTicket({ entry, replay }) {
  return <><small>{entry.destination}{replay ? ' · Repetição' : ''}</small><strong>{entry.team.nome}</strong></>
}

function DrawUrn({ remaining, number, phase, cycle, entry, replay, ticketRef, onOpen, disabled }) {
  const openButtonRef = useRef(null)
  useEffect(() => {
    if (phase === 'ready') openButtonRef.current?.focus({ preventScroll: true })
  }, [phase])
  const open = ['opening', 'revealing', 'flying', 'landing', 'settled'].includes(phase)
  return <div className={`draw-lottery-machine phase-${phase}`}>
    <div className="draw-urn-globe" aria-hidden="true"><div className="draw-urn-balls">{Array.from({ length: Math.min(remaining, 12) }, (_, index) => <i className="draw-mixing-ball" key={index} style={{ '--ball-x': `${12 + (index * 31) % 126}px`, '--ball-y': `${84 + (index * 19) % 42}px`, '--ball-dx': `${(index % 2 ? 1 : -1) * (14 + index * 3)}px`, '--ball-dy': `${-48 - (index * 11) % 62}px`, '--ball-speed': `${.72 + index * .09}s`, '--ball-delay': `${-index * .17}s` }}>?</i>)}</div><div className="draw-urn-shine" /></div>
    <div className="draw-urn-neck" aria-hidden="true" /><div className="draw-urn-base" aria-hidden="true"><span>INTERCLASSE</span><i /></div>
    <div key={cycle} className="draw-capsule">
      {phase === 'ready' ? <button ref={openButtonRef} className="draw-open-capsule" type="button" aria-label="Abrir bolinha e revelar turma" disabled={disabled} onClick={onOpen}><span>Clique para abrir</span></button> : null}
      <div className="draw-capsule-pieces" aria-hidden="true">
        <span className="draw-capsule-glow" />
        <span className="draw-capsule-half draw-capsule-top" />
        <span className="draw-capsule-half draw-capsule-bottom" />
        <span className="draw-capsule-seam" />
        <span className="draw-capsule-number">{number}</span>
        <div ref={ticketRef} className="draw-team-ticket draw-capsule-ticket">{open ? <TeamTicket entry={entry} replay={replay} /> : null}</div>
      </div>
    </div>
  </div>
}

function Confetti() {
  return <div className="draw-confetti" aria-hidden="true">{Array.from({ length: 48 }, (_, index) => <i key={index} style={{ '--confetti-left': `${(index * 37) % 100}%`, '--confetti-delay': `${(index % 8) * .11}s`, '--confetti-drift': `${(index % 2 ? 1 : -1) * (25 + index % 7 * 12)}px`, '--confetti-color': ['#67e8f9', '#f9cc47', '#ff7772', '#c4b5fd'][index % 4] }} />)}</div>
}

function OpeningMatches({ games, active, reduced }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const available = games.slice(0, 6)
  const current = available.length ? index % available.length : 0
  const automatic = active && !paused && !reduced && available.length > 1
  useEffect(() => {
    if (!automatic) return
    const timer = window.setInterval(() => { if (!document.hidden) setIndex((value) => value + 1) }, 3400)
    return () => window.clearInterval(timer)
  }, [automatic])
  const game = available[current]
  if (!game) return null
  return <section className="draw-opening-matches" hidden={!active} aria-label="Apresentação dos primeiros confrontos">
    <div className="draw-opening-heading"><div><span className="draw-eyebrow">O próximo capítulo</span><h3>Primeiros confrontos</h3></div><span>{current + 1} de {available.length}</span></div>
    <div className="draw-opening-card" key={`${game.id}-${current}`} aria-live={automatic ? 'off' : 'polite'}><span>{game.groupName || game.fase}</span><div><strong>{game.timeA}</strong><span aria-hidden="true">×</span><strong>{game.timeB}</strong></div></div>
    {available.length > 1 ? <div className="draw-match-controls"><button type="button" className="draw-button" onClick={() => { setPaused(true); setIndex((value) => (value + available.length - 1) % available.length) }}>Confronto anterior</button>{!reduced ? <button type="button" className="draw-button" onClick={() => setPaused((value) => !value)}>{paused ? 'Continuar confrontos' : 'Pausar confrontos'}</button> : null}<button type="button" className="draw-button" onClick={() => { setPaused(true); setIndex((value) => value + 1) }}>Próximo confronto</button></div> : null}
    <p className="draw-note">Confrontos definidos pelo sorteio. Os dias e horários serão preenchidos depois.</p>
  </section>
}

export default function TournamentDrawDialog({ draw, teams, config, openingGames = [], onClose, onApply }) {
  const dialogRef = useRef(null), presentationRef = useRef(null), ticketRef = useRef(null), flightRef = useRef(null), stageRef = useRef(null), finaleRef = useRef(null)
  const slotRefs = useRef(new Map())
  const titleId = useId()
  const [state, dispatch] = useReducer(drawPresentationReducer, draw.teams.length, createDrawPresentation)
  const [fullscreenError, setFullscreenError] = useState('')
  const [motionPreference, setMotionPreference] = useState(readMotionPreference)
  const systemReduced = useReducedMotion()
  const reduced = motionPreference === 'reduced' || (motionPreference === 'system' && systemReduced)
  const stale = draw.fingerprint !== drawFingerprint(teams, config)
  const sections = useMemo(() => drawSections(draw.teams, draw.config), [draw.teams, draw.config])
  const order = useMemo(() => drawRevealOrder(draw.teams, draw.config), [draw.teams, draw.config])
  const revealed = new Set(order.slice(0, state.count).map((entry) => entry.index))
  const entry = order[state.active]
  const busy = !['idle', 'settled'].includes(state.phase)
  const allRevealed = state.count === state.total
  const finished = allRevealed && !busy
  const showing = ['revealing', 'flying', 'landing', 'settled'].includes(state.phase) && (busy || state.count > 0)
  const running = state.automatic && !allRevealed && !stale
  const advancing = state.phase === 'settled' && running
  useModalDialog(dialogRef)

  useEffect(() => {
    const presentation = presentationRef.current
    return () => { if (document.fullscreenElement === presentation) document.exitFullscreen().catch(() => {}) }
  }, [])

  useEffect(() => {
    if (stale) return
    const timing = {
      mixing: ['show', reduced ? 80 : 900],
      ejecting: ['ready', reduced ? 100 : EJECTION_DURATION],
      opening: ['reveal', reduced ? 100 : OPENING_DURATION],
      revealing: ['fly', READING_DURATION],
      flying: ['land', reduced ? 20 : FLIGHT_DURATION + 40],
      landing: ['settle', 600],
      settled: ['advance', 750],
    }[state.phase]
    if (!timing || (state.phase === 'settled' && !advancing)) return
    const timer = window.setTimeout(() => dispatch({ type: timing[0], cycle: state.cycle }), timing[1])
    return () => window.clearTimeout(timer)
  }, [state.phase, state.cycle, advancing, reduced, stale])

  useLayoutEffect(() => {
    if (stale || reduced || state.phase !== 'flying' || !entry) return
    const target = slotRefs.current.get(entry.index), card = flightRef.current, ticket = ticketRef.current
    if (!target || !card || !ticket) return
    const scroller = document.fullscreenElement === presentationRef.current ? presentationRef.current : dialogRef.current
    const frame = presentationRef.current.getBoundingClientRect(), origin = ticket.getBoundingClientRect(), destination = target.getBoundingClientRect()
    const offset = scroller === presentationRef.current ? scroller.scrollTop : 0
    Object.assign(card.style, { width: `${origin.width}px`, left: `${origin.left - frame.left}px`, top: `${origin.top - frame.top + offset}px`, visibility: 'visible' })
    const dx = destination.left + destination.width / 2 - (origin.left + origin.width / 2)
    const dy = destination.top + destination.height / 2 - (origin.top + origin.height / 2)
    const lift = Math.min(65, Math.max(28, Math.abs(dx) * .12))
    const animation = card.animate?.([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * .12}px, ${dy * .08 - lift}px) rotate(-5deg) scale(1.06)`, opacity: 1, offset: .22 },
      { transform: `translate(${dx * .52}px, ${dy * .45 - lift}px) rotate(4deg) scale(1.03)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx * .9}px, ${dy * .85 - 10}px) rotate(-2deg) scale(.94)`, opacity: 1, offset: .82 },
      { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(.88)`, opacity: 1 },
    ], { duration: FLIGHT_DURATION, easing: 'linear', fill: 'forwards' })
    let frameId
    const follow = () => {
      const view = scroller.getBoundingClientRect(), bounds = card.getBoundingClientRect()
      const bottom = Math.min(view.bottom, window.innerHeight) - 28, top = Math.max(view.top, 0) + 24
      if (bounds.bottom > bottom) scroller.scrollTop += bounds.bottom - bottom
      else if (bounds.top < top) scroller.scrollTop -= top - bounds.top
      frameId = window.requestAnimationFrame(follow)
    }
    frameId = window.requestAnimationFrame(follow)
    return () => { animation?.cancel(); window.cancelAnimationFrame(frameId) }
  }, [state.phase, state.cycle, entry, reduced, stale])

  useEffect(() => {
    const target = finished ? finaleRef.current : state.phase === 'mixing' ? stageRef.current : null
    if (!target) return
    const scroller = document.fullscreenElement === presentationRef.current ? presentationRef.current : dialogRef.current
    const frame = scroller.getBoundingClientRect(), bounds = target.getBoundingClientRect()
    scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + bounds.top - frame.top - 18), behavior: reduced ? 'instant' : 'smooth' })
  }, [finished, state.cycle, reduced, state.phase])

  const controls = <div className="draw-controls">
    {!allRevealed ? <><button type="button" className="draw-button draw-button-primary" disabled={stale} onClick={() => dispatch({ type: running ? 'pause' : 'automatic' })}>{running ? 'Pausar apresentação' : state.count || busy ? 'Continuar automaticamente' : 'Iniciar apresentação'}</button><button type="button" className="draw-button" disabled={busy || running || stale} onClick={() => dispatch({ type: 'next' })}>Revelar próxima turma</button><button type="button" className="draw-button" disabled={stale} onClick={() => dispatch({ type: 'skip' })}>Revelar restantes</button></> : <button type="button" className="draw-button draw-button-primary" disabled={busy || stale} onClick={() => onApply(draw.teams.map((team) => team.id))}>Usar resultado na prévia</button>}
    {state.count > 0 ? <button type="button" className="draw-button" disabled={busy || stale} onClick={() => dispatch({ type: 'repeat' })}>Repetir última revelação</button> : null}
  </div>

  return <dialog ref={dialogRef} className={`tournament-draw-dialog ${reduced ? 'draw-reduced-motion' : 'draw-full-motion'}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="draw-presentation" ref={presentationRef} style={{ '--draw-ejection-duration': `${EJECTION_DURATION}ms`, '--draw-opening-duration': `${OPENING_DURATION}ms` }}>
      {state.celebrated && !reduced ? <Confetti /> : null}
      <header className="draw-heading"><div><span className="draw-eyebrow">Interclasse · {draw.sportName} · {draw.shiftName}</span><h2 id={titleId}>{finished ? 'Sorteio concluído' : 'Sorteio das turmas'}</h2><p>{draw.tournamentName || 'Apresentação dos grupos e confrontos'}</p></div><div className="draw-window-actions"><button type="button" className="draw-button" onClick={async () => {
        setFullscreenError('')
        try { if (document.fullscreenElement === presentationRef.current) await document.exitFullscreen(); else if (presentationRef.current.requestFullscreen) await presentationRef.current.requestFullscreen(); else setFullscreenError('Use a opção de tela cheia do navegador para projetar o sorteio.') }
        catch { setFullscreenError('Use a opção de tela cheia do navegador para projetar o sorteio.') }
      }}>Tela cheia</button><button type="button" className="draw-button" onClick={onClose}>Fechar</button></div></header>
      <div className="draw-motion-settings"><label>Animação do sorteio<select value={motionPreference} disabled={busy && state.phase !== 'ready'} onChange={(event) => {
        const value = event.target.value
        setMotionPreference(value)
        try { localStorage.setItem('bolao-draw-motion', value) } catch { /* Keep the selected mode for this presentation. */ }
      }}><option value="full">Completa e suave</option><option value="system">Seguir preferência do dispositivo</option><option value="reduced">Sem movimentos</option></select></label>{reduced ? <p>Modo sem movimentos ativo. Para ver a bolinha abrindo e o voo da turma, selecione “Completa e suave”.</p> : <p>Abertura de 3,25 s · Equipe em destaque por 2,25 s · Voo de 2,75 s</p>}</div>
      {stale ? <p className="draw-alert" role="alert">As turmas ou a configuração mudaram. Feche e inicie um novo sorteio antes de usar o resultado.</p> : null}
      {fullscreenError ? <p className="draw-note" role="status">{fullscreenError}</p> : null}
      {finished ? <section className="draw-finale" ref={finaleRef}><div className="draw-finale-title" role="status"><span aria-hidden="true">★</span><div><span className="draw-eyebrow">O caminho está traçado</span><h3>{draw.config.formato === 'grupos-mata-mata' ? 'Grupos definidos. Prepare a torcida!' : 'Turmas definidas. Que venham os jogos!'}</h3><p>{state.total} turmas reveladas · {sections.length} {draw.config.formato === 'sorteio' ? 'confronto(s)' : 'grupo(s)'}</p></div></div>{controls}</section> : null}
      <div className={`draw-stage-layout ${finished ? 'is-finished' : ''}`}>
        {!finished ? <section ref={stageRef} className={`draw-stage ${state.phase === 'mixing' ? 'is-drawing' : ''}`} aria-label="Revelação das turmas">
          <span className="draw-eyebrow">{state.replay ? 'Repetição da última revelação' : { mixing: 'Misturando as bolinhas…', ejecting: 'A bolinha saiu da urna!', ready: 'A surpresa está nas suas mãos', opening: 'Abrindo a bolinha…', revealing: 'A turma está aqui dentro!', flying: 'A caminho do grupo', landing: 'Chegou ao seu destino!' }[state.phase] || (state.count ? 'Turma confirmada no seu destino' : 'Tudo pronto para começar')}</span>
          <DrawUrn remaining={state.replay ? 1 : Math.max(0, state.total - state.count - (busy && state.phase !== 'mixing' && state.phase !== 'landing' ? 1 : 0))} number={state.phase !== 'idle' && state.phase !== 'mixing' ? state.active + 1 : '?'} phase={state.phase} cycle={state.cycle} entry={entry} replay={state.replay} ticketRef={ticketRef} disabled={stale} onOpen={() => dispatch({ type: 'open', cycle: state.cycle })} />
          <div className="draw-announcement" role="status" aria-live="polite" aria-atomic="true"><strong>{showing ? entry.destination : state.phase === 'ready' ? 'Clique na bolinha para abrir' : state.phase === 'opening' ? 'Quem está aí dentro?' : state.phase === 'ejecting' ? 'Uma surpresa a caminho…' : state.phase === 'mixing' ? 'Quem será a próxima turma?' : 'Quem vem primeiro?'}</strong><span>{showing ? `${state.replay ? 'Repetição · ' : ''}${entry.team.nome}` : state.phase === 'ready' ? 'Toque na bolinha ou pressione Enter para revelar a turma.' : 'Cada turma segue para a posição sorteada.'}</span></div>
          <p className="draw-counter">{state.count} de {state.total} turmas reveladas</p><progress max={state.total} value={state.count} aria-label="Progresso do sorteio" />
          {controls}
          {running || busy ? <p className="draw-note">Cada bolinha aguarda seu clique para abrir. Ao pausar, a revelação em andamento termina antes da próxima turma.</p> : null}
          {state.replay ? <p className="draw-note">A repetição mantém todas as turmas nas posições já sorteadas.</p> : null}
        </section> : null}
        <section className="draw-results" aria-label="Resultado do sorteio">{sections.map((section) => <article className={`draw-group ${showing && section.label === entry.destination ? 'is-destination' : ''}`} key={section.label}><h3>{section.label}</h3><ol>{section.slots.map(({ team, index }, position) => <li ref={(element) => { if (element) slotRefs.current.set(index, element); else slotRefs.current.delete(index) }} key={team.id} data-draw-slot={index} className={`${revealed.has(index) ? 'is-revealed' : ''} ${showing && index === entry.index ? state.phase === 'flying' ? 'is-incoming' : revealed.has(index) ? 'is-latest' : '' : ''}`}><span className="draw-slot-number" aria-hidden="true">{position + 1}</span><span>{revealed.has(index) ? team.nome : 'A sortear'}</span></li>)}</ol></article>)}</section>
      </div>
      <OpeningMatches games={openingGames} active={finished && !stale} reduced={reduced} />
      {state.phase === 'flying' && !reduced && !stale ? <div ref={flightRef} key={state.cycle} className="draw-team-ticket draw-flight-card" aria-hidden="true"><TeamTicket entry={entry} replay={state.replay} /></div> : null}
      {draw.config.formato === 'sorteio' && draw.teams.length % 2 ? <p className="draw-note">Uma turma fica sem adversário nesta rodada. Não será criado avanço automático.</p> : null}
      <footer className="draw-footer"><p>Depois de concluir, confira a prévia e clique em Salvar chaveamento para criar os jogos.</p></footer>
    </div>
  </dialog>
}
