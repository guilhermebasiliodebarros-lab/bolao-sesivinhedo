import { useEffect, useId, useRef, useState } from 'react'
import { drawFingerprint, drawSections } from '../utils/tournamentDraw.js'
import './TournamentDrawDialog.css'
import useModalDialog from '../hooks/useModalDialog.js'

export default function TournamentDrawDialog({ draw, teams, config, onClose, onApply }) {
  const dialogRef = useRef(null)
  const presentationRef = useRef(null)
  const titleId = useId()
  const [revealed, setRevealed] = useState(0)
  const [automatic, setAutomatic] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  const stale = draw.fingerprint !== drawFingerprint(teams, config)
  const complete = revealed === draw.teams.length
  const running = automatic && !complete && !stale
  const sections = drawSections(draw.teams, draw.config)
  const latest = revealed ? draw.teams[revealed - 1] : null
  const destination = revealed ? sections.find((section) => section.slots.some((slot) => slot.index === revealed - 1))?.label : ''
  useModalDialog(dialogRef)

  useEffect(() => {
    const presentation = presentationRef.current
    return () => { if (document.fullscreenElement === presentation) document.exitFullscreen().catch(() => {}) }
  }, [])

  useEffect(() => {
    if (!running) return
    const timer = window.setTimeout(() => setRevealed((count) => Math.min(count + 1, draw.teams.length)), 1800)
    return () => window.clearTimeout(timer)
  }, [running, revealed, draw.teams.length])

  return <dialog ref={dialogRef} className="tournament-draw-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="draw-presentation" ref={presentationRef}>
    <header className="draw-heading">
      <div><span className="draw-eyebrow">Interclasse · {draw.sportName} · {draw.shiftName}</span><h2 id={titleId}>{complete ? 'Sorteio concluído' : 'Sorteio das turmas'}</h2><p>{draw.tournamentName || 'Apresentação dos grupos e confrontos'}</p></div>
      <div className="draw-window-actions">
        <button type="button" className="draw-button" onClick={async () => {
          setFullscreenError('')
          try {
            if (document.fullscreenElement === presentationRef.current) await document.exitFullscreen()
            else if (presentationRef.current.requestFullscreen) await presentationRef.current.requestFullscreen()
            else setFullscreenError('Use a opção de tela cheia do navegador para projetar o sorteio.')
          } catch { setFullscreenError('Use a opção de tela cheia do navegador para projetar o sorteio.') }
        }}>Tela cheia</button>
        <button type="button" className="draw-button" onClick={onClose}>Fechar</button>
      </div>
    </header>

    {stale ? <p className="draw-alert" role="alert">As turmas ou a configuração mudaram. Feche e inicie um novo sorteio antes de usar o resultado.</p> : null}
    {fullscreenError ? <p className="draw-note" role="status">{fullscreenError}</p> : null}

    <div className="draw-stage-layout">
      <section className={`draw-stage ${running ? 'is-drawing' : ''} ${complete ? 'is-complete' : ''}`} aria-label="Revelação das turmas">
        <div className="draw-orbit" aria-hidden="true"><i /><i /><i /></div>
        <span className="draw-eyebrow">{complete ? 'Todas as turmas reveladas' : running ? 'Preparando a próxima turma…' : revealed ? 'Última turma sorteada' : 'Tudo pronto para começar'}</span>
        <div className="draw-ball" key={revealed} aria-hidden="true">{revealed || '?'}</div>
        <div className="draw-announcement" role="status" aria-live="polite" aria-atomic="true">
          <strong>{latest?.nome || 'Quem vem primeiro?'}</strong>
          <span>{destination || 'Inicie a apresentação ou revele uma turma por vez.'}</span>
        </div>
        <p className="draw-counter">{revealed} de {draw.teams.length} turmas reveladas</p>
        <progress max={draw.teams.length} value={revealed} aria-label="Progresso do sorteio" />
        <div className="draw-controls">
          {!complete ? <>
            <button type="button" className="draw-button draw-button-primary" disabled={stale} onClick={() => setAutomatic((value) => !value)}>{running ? 'Pausar apresentação' : revealed ? 'Continuar automaticamente' : 'Iniciar apresentação'}</button>
            <button type="button" className="draw-button" disabled={running || stale} onClick={() => setRevealed((count) => Math.min(count + 1, draw.teams.length))}>Revelar próxima turma</button>
            <button type="button" className="draw-button" disabled={stale} onClick={() => { setAutomatic(false); setRevealed(draw.teams.length) }}>Revelar restantes</button>
          </> : <button type="button" className="draw-button draw-button-primary" disabled={stale} onClick={() => onApply(draw.teams.map((team) => team.id))}>Usar resultado na prévia</button>}
        </div>
        {draw.config.formato === 'sorteio' && draw.teams.length % 2 ? <p className="draw-note">Com quantidade ímpar, uma turma ficará sem adversário nesta rodada. Não será criado avanço automático.</p> : null}
      </section>

      <section className="draw-results" aria-label="Resultado do sorteio">
        {sections.map((section) => <article className="draw-group" key={section.label}>
          <h3>{section.label}</h3>
          <ol>{section.slots.map(({ team, index }) => <li key={team.id} className={index < revealed ? `is-revealed ${index === revealed - 1 ? 'is-latest' : ''}` : ''}>
            <span className="draw-slot-number" aria-hidden="true">{index + 1}</span>
            <span>{index < revealed ? team.nome : 'A sortear'}</span>
          </li>)}</ol>
        </article>)}
      </section>
    </div>

    <footer className="draw-footer">
      <p>O sorteio respeita a modalidade e o turno selecionados. Depois de concluir, confira a prévia e clique em Salvar chaveamento para criar os jogos.</p>
    </footer>
    </div>
  </dialog>
}
