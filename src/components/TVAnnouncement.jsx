import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TV_ANNOUNCEMENT_TYPES } from '../utils/tvAnnouncements.js'
import './TVAnnouncement.css'

export function TVSirenButton({ sound }) {
  const label = sound.enabled ? 'Desativar sirene' : 'Ativar sirene'
  return <div className="tv-siren-control">
    <button type="button" aria-label={label} title={label} aria-pressed={sound.enabled} onClick={sound.toggle}>
      <span aria-hidden="true">{sound.enabled ? '🔊' : '🔇'}</span>
      <span>{sound.enabled ? 'Sirene ativa' : 'Ativar sirene'}</span>
    </button>
    {sound.error ? <small role="status">{sound.error}</small> : null}
  </div>
}

export default function TVAnnouncement({ announcement, rehearsal = false }) {
  const layer = useRef(null)
  const id = announcement?.id

  useLayoutEffect(() => {
    const element = layer.current
    if (!id || !element?.showPopover) return
    element.showPopover()
    return () => {
      if (element.matches(':popover-open')) element.hidePopover()
    }
  }, [id])

  if (!announcement) return null
  return createPortal(
    <aside key={id} ref={layer} popover="manual" className={`tv-announcement-overlay is-${announcement.type}${announcement.text.length > 120 ? ' is-long' : ''}`} role="alert">
      <div className="tv-announcement-content">
        <img src="/logo-interclasse.webp" alt="Interclasse SESI Vinhedo" />
        <strong>{rehearsal ? 'Ensaio · ' : ''}{TV_ANNOUNCEMENT_TYPES[announcement.type]}</strong>
        <p>{announcement.text}</p>
      </div>
      <div className="tv-announcement-progress" aria-hidden="true" style={{ animationDuration: `${announcement.remainingMs}ms` }} />
    </aside>,
    document.body,
  )
}
