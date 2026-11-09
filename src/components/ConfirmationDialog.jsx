import { useId, useRef } from 'react'
import useModalDialog from '../hooks/useModalDialog.js'

export default function ConfirmationDialog({ title, description, confirmLabel, busy, onClose, onConfirm }) {
  const ref = useRef(null)
  const titleId = useId(), descriptionId = useId()
  useModalDialog(ref)
  return <dialog ref={ref} className="confirmation-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }} onKeyDown={(event) => {
    if (event.key !== 'Tab') return
    const controls = [...ref.current.querySelectorAll('button:not(:disabled)')]
    const first = controls[0], last = controls.at(-1)
    if (!first || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first)?.focus()
    }
  }} onClick={(event) => {
    if (busy || event.target !== ref.current) return
    const bounds = ref.current.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }}>
    <section className="confirm-modal">
      <div className="confirm-modal-mark" aria-hidden="true" />
      <div className="confirm-modal-content"><span className="eyebrow">Confirmação</span><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div>
      <div className="modal-actions"><button className="btn btn-outline" type="button" autoFocus disabled={busy} onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Processando…' : confirmLabel}</button></div>
    </section>
  </dialog>
}
