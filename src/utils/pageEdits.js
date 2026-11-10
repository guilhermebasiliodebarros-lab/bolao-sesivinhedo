const valueOf = (field) => field.type === 'checkbox' || field.type === 'radio' ? field.checked : field.isContentEditable ? field.textContent : field.type === 'file' ? [...(field.files || [])].map((file) => `${file.name}:${file.size}:${file.lastModified}`).join('|') : field.value
const editable = (field) => field?.matches?.('input:not([type=hidden]):not([type=button]):not([type=submit]),textarea,select,[contenteditable=true]') && !field.readOnly && !field.disabled && !field.closest('[data-update-safe]') && field.closest('form,dialog,[data-protect-updates]')

// Remember values before editing. Never serialize form contents, passwords or files into storage.
export function trackPageEdits(doc, now = Date.now) {
  const originals = new WeakMap(), modified = new Map()
  let lastInteraction = -Infinity
  const remember = (event) => {
    const field = event.target
    if (editable(field) && !originals.has(field)) originals.set(field, valueOf(field))
  }
  const changed = (event) => {
    lastInteraction = now()
    const field = event.target
    if (!editable(field)) return
    const original = originals.has(field) ? originals.get(field) : field.defaultValue ?? ''
    if (valueOf(field) === original) modified.delete(field)
    else modified.set(field, original)
  }
  const interacted = () => { lastInteraction = now() }
  const events = [['focusin', remember], ['beforeinput', remember], ['input', changed], ['change', changed], ['pointerdown', interacted], ['keydown', interacted]]
  events.forEach(([name, handler]) => doc.addEventListener(name, handler, true))
  return {
    hasPendingChanges() {
      if (now() - lastInteraction < 5000 || doc.querySelector('dialog[open],[aria-busy=true],[data-protect-updates=true]')) return true
      for (const [field, original] of modified) {
        if (!field.isConnected || valueOf(field) === original) modified.delete(field)
      }
      return modified.size > 0
    },
    dispose() { events.forEach(([name, handler]) => doc.removeEventListener(name, handler, true)); modified.clear() },
  }
}
