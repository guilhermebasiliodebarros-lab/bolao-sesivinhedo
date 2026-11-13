// One channel can serve several React subscribers, with one listener and one recovery timer.
export function createRealtimeChannel({ listen, read, interval = 30000, environment = {} }) {
  const win = environment.window ?? globalThis.window
  const doc = environment.document ?? globalThis.document
  const online = () => (environment.isOnline?.() ?? globalThis.navigator?.onLine) !== false
  const visible = () => !doc?.hidden
  const later = environment.setTimeout ?? globalThis.setTimeout
  const cancel = environment.clearTimeout ?? globalThis.clearTimeout
  const subscribers = new Set()
  let snapshot, stop, retry, startup, heartbeat, generation = 0, revision = 0, failures = 0, reading = false, synced = false, lastServerAt = null, lastError = null
  const status = () => ({ lastServerAt, state: !online() ? 'offline' : lastError ? 'reconnecting' : synced ? 'live' : 'syncing' })
  const broadcastSync = () => subscribers.forEach((subscriber) => subscriber.onSync?.(synced, status()))
  const deliver = (value) => {
    snapshot = value
    revision += 1
    synced = online() && !value.metadata?.fromCache && !value.metadata?.hasPendingWrites
    if (synced) { lastServerAt = Date.now(); failures = 0; lastError = null }
    subscribers.forEach((subscriber) => {
      if (synced && subscriber.failed) { subscriber.failed = false; subscriber.onError?.(null) }
      subscriber.onData(value)
    })
    broadcastSync()
  }
  const fail = (error) => {
    synced = false
    lastError = error
    broadcastSync()
    subscribers.forEach((subscriber) => { subscriber.failed = true; subscriber.onError?.(error) })
  }
  const restart = () => {
    cancel(retry)
    stop?.()
    stop = undefined
    const token = ++generation
    synced = false
    broadcastSync()
    if (!subscribers.size || !online()) return
    const failed = (error) => {
      if (token !== generation || !subscribers.size) return
      fail(error)
      cancel(retry)
      retry = later(restart, Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)))
    }
    try { stop = listen((value) => { if (token === generation && subscribers.size) deliver(value) }, failed) } catch (error) { failed(error) }
  }
  const recover = async () => {
    if (!read || reading || !subscribers.size || !online() || !visible() || snapshot?.metadata?.hasPendingWrites) return
    reading = true
    const before = revision, token = generation
    try {
      const fresh = await read(snapshot)
      // A slower request must never overwrite a newer score received by the live listener.
      if (subscribers.size && token === generation && revision === before && online()) deliver(fresh)
    } catch (error) { if (subscribers.size && token === generation && revision === before) fail(error) }
    finally { reading = false }
  }
  const tick = () => {
    heartbeat = later(() => { recover(); tick() }, interval)
  }
  const resume = () => {
    if (!visible() || !online()) return
    restart()
    recover()
  }
  const offline = () => { synced = false; broadcastSync() }
  const cleanup = () => {
    ++generation
    stop?.(); stop = undefined
    cancel(retry); cancel(startup); cancel(heartbeat)
    win?.removeEventListener('online', resume)
    win?.removeEventListener('offline', offline)
    doc?.removeEventListener('visibilitychange', resume)
    snapshot = undefined; synced = false; lastServerAt = null; lastError = null
  }
  return {
    refresh: resume,
    subscribe(onData, onError, onSync) {
      const subscriber = { onData, onError, onSync, failed: false }
      subscribers.add(subscriber)
      if (subscribers.size === 1) {
        win?.addEventListener('online', resume)
        win?.addEventListener('offline', offline)
        doc?.addEventListener('visibilitychange', resume)
        restart()
        if (read) { tick(); startup = later(() => { if (!synced) recover() }, 4000) }
      } else {
        if (lastError) { subscriber.failed = true; onError?.(lastError) }
        if (snapshot) onData(snapshot)
        onSync?.(synced, status())
      }
      return () => { subscribers.delete(subscriber); if (!subscribers.size) cleanup() }
    },
  }
}

export async function recoverCollection(snapshot, { readAll, readChanged, readCount }) {
  if (!snapshot || snapshot.metadata?.fromCache) return readAll()
  const timestamps = snapshot.docs.map((item) => item.data().updatedAt).filter((value) => typeof value?.toMillis === 'function')
  const cursor = timestamps.reduce((latest, value) => !latest || value.toMillis() > latest.toMillis() ? value : latest, null)
  if (!cursor) return readAll()
  const [changed, count] = await Promise.all([readChanged(cursor), readCount()])
  const merged = new Map(snapshot.docs.map((item) => [item.id, item]))
  changed.docs.forEach((item) => merged.set(item.id, item))
  // Count detects deletions, including a simultaneous creation and deletion with equal totals.
  if (snapshot.docs.length !== count || merged.size !== count) return readAll()
  return { docs: [...merged.values()], metadata: { fromCache: false, hasPendingWrites: false } }
}
