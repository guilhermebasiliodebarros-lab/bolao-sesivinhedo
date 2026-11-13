export const TRANSMISSION_LABELS = { live: 'TV conectada', offline: 'Sem internet', stale: 'Atualização atrasada', syncing: 'Conferindo servidor', reconnecting: 'Reconectando' }

export function transmissionHealth({ now = Date.now(), startedAt = now, online = true, connected = false, error = false, feeds = [] }) {
  const time = now instanceof Date ? now.getTime() : now
  const sources = feeds.map((feed) => {
    const at = Number(feed.lastServerAt)
    const confirmed = Number.isFinite(at) && at > 0
    const ageMs = Math.max(0, time - (confirmed ? at : startedAt))
    return { ...feed, lastServerAt: confirmed ? at : null, ageMs, stale: ageMs > (feed.maxAgeMs || 75000) }
  })
  const state = !online ? 'offline' : error ? 'reconnecting' : sources.some((feed) => feed.stale) ? 'stale' : !connected || !sources.length || sources.some((feed) => !feed.lastServerAt) ? 'syncing' : 'live'
  const confirmed = sources.filter((feed) => feed.lastServerAt).map((feed) => feed.lastServerAt)
  return { state, label: TRANSMISSION_LABELS[state], connected: state === 'live', feeds: sources, lastServerAt: confirmed.length === sources.length && confirmed.length ? Math.min(...confirmed) : null }
}

export function confirmationAge(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}
