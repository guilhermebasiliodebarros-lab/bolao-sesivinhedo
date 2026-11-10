import { useCallback, useState, useSyncExternalStore } from 'react'
import { readPreference, writePreference } from '../utils/preferences.js'

const eventName = 'bolao:prediction-mode'
const mobileQuery = '(max-width: 700px), (pointer: coarse) and (max-width: 1024px)'
const subscribeMode = (callback) => {
  window.addEventListener('storage', callback)
  window.addEventListener(eventName, callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(eventName, callback) }
}
const subscribeSize = (callback) => {
  const query = window.matchMedia(mobileQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const isMobile = () => window.matchMedia(mobileQuery).matches

export default function useQuickPredictionMode(userId) {
  const key = `bolao:prediction-mode:${encodeURIComponent(userId || 'guest')}`
  const getMode = useCallback(() => new URLSearchParams(window.location.search).get('modo') === 'palpite' ? 'quick' : readPreference(key, readPreference('bolao:prediction-mode:guest', 'auto')), [key])
  const mode = useSyncExternalStore(subscribeMode, getMode)
  const [sessionMode, setSessionMode] = useState(null)
  const mobile = useSyncExternalStore(subscribeSize, isMobile)
  const resolvedMode = sessionMode?.key === key ? sessionMode.mode : mode
  const quick = resolvedMode === 'quick' || (resolvedMode !== 'full' && mobile)
  const setQuick = (enabled) => {
    const value = enabled ? 'quick' : 'full'
    const stored = writePreference(key, value)
    setSessionMode(stored ? null : { key, mode: value })
    if (!enabled) {
      const url = new URL(window.location.href)
      url.searchParams.delete('modo')
      window.history.replaceState(window.history.state, '', url)
    }
    window.dispatchEvent(new Event(eventName))
  }
  return { quick, setQuick }
}
