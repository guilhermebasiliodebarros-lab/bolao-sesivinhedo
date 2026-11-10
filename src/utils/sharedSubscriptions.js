// Keep only active entries: releasing the last consumer discards cached private data.
export function createSharedSubscriptions({ equal, create, onRemove = () => {} }) {
  const entries = new Set()
  return function subscribe(source, onData, onError, onSync) {
    let entry = [...entries].find((item) => equal(item.source, source))
    if (!entry) {
      entry = { source, channel: create(source), consumers: 0 }
      entries.add(entry)
    }
    entry.consumers++
    const stop = entry.channel.subscribe(onData, onError, onSync)
    let active = true
    return () => {
      if (!active) return
      active = false
      stop()
      if (--entry.consumers === 0) { entries.delete(entry); onRemove(entry.channel) }
    }
  }
}
