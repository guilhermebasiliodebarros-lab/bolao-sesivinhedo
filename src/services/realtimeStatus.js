const feeds = new Map()
const subscribers = new Set()
let current = { state: 'idle', feeds: 0 }

export function updateRealtimeStatus(channel, status) {
  if (status) feeds.set(channel, status)
  else feeds.delete(channel)
  const values = [...feeds.values()]
  const state = !values.length ? 'idle' : values.some((item) => item.state === 'offline') ? 'offline' : values.some((item) => item.state === 'reconnecting') ? 'reconnecting' : values.every((item) => item.state === 'live') ? 'live' : 'syncing'
  if (current.state === state && current.feeds === values.length) return
  current = { state, feeds: values.length }
  subscribers.forEach((callback) => callback())
}
export const getRealtimeStatus = () => current
export const subscribeRealtimeStatus = (callback) => { subscribers.add(callback); return () => subscribers.delete(callback) }
