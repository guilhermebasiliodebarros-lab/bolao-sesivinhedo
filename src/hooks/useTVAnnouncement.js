import { useEffect, useRef, useState } from 'react'
import { subscribeTVAnnouncement } from '../services/bolaoService.js'
import { getSirenContext, playTVSiren } from '../services/tvSiren.js'
import { readPreference, writePreference } from '../utils/preferences.js'
import { activeTVAnnouncement, TV_ANNOUNCEMENT_MS, TV_SIREN_MS } from '../utils/tvAnnouncements.js'

const soundPreference = 'tv-siren-enabled'
const heardKey = 'tv-last-announcement-heard'
function lastHeard() {
  try { return sessionStorage.getItem(heardKey) }
  catch { return null }
}

export default function useTVAnnouncement() {
  const [announcement, setAnnouncement] = useState(null)
  const [error, setError] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(() => readPreference(soundPreference) === 'true')
  const [soundReady, setSoundReady] = useState(false)
  const [soundError, setSoundError] = useState('')
  const [lastSync, setLastSync] = useState(null)
  const [synced, setSynced] = useState(false)
  const heard = useRef(lastHeard())

  useEffect(() => subscribeTVAnnouncement(
    (value) => {
      const receivedAt = Date.now()
      const active = activeTVAnnouncement(value, receivedAt)
      const current = active ? { ...active, remainingMs: Math.min(TV_ANNOUNCEMENT_MS, active.expiresAt - receivedAt) } : null
      setAnnouncement((previous) => previous?.id === current?.id ? previous : current)
      setError('')
    },
    setError,
    (connected, info) => {
      setSynced(connected)
      if (connected) setLastSync(info?.lastServerAt || Date.now())
    },
  ), [])

  useEffect(() => {
    if (!announcement) return
    const timer = window.setTimeout(() => {
      setAnnouncement((previous) => previous?.id === announcement.id ? null : previous)
    }, Math.max(0, announcement.expiresAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [announcement])

  useEffect(() => {
    if (!soundEnabled) return
    try {
      const context = getSirenContext()
      const update = () => setSoundReady(context.state === 'running')
      context.addEventListener('statechange', update)
      if (context.state !== 'running') context.resume().catch(() => {})
      const timer = window.setTimeout(update, 0)
      return () => {
        window.clearTimeout(timer)
        context.removeEventListener('statechange', update)
      }
    } catch {
      // The button stays available if the platform requires a click to start sound.
    }
  }, [soundEnabled])

  useEffect(() => {
    if (!soundEnabled || !soundReady || !announcement || heard.current === announcement.id) return
    if (Date.now() >= announcement.publishedAt + TV_SIREN_MS) return
    const context = getSirenContext()
    if (context.state !== 'running') return
    const stop = playTVSiren(context)
    heard.current = announcement.id
    try { sessionStorage.setItem(heardKey, announcement.id) } catch { /* The open tab still remembers this notice. */ }
    return stop
  }, [announcement, soundEnabled, soundReady])

  const toggleSound = async () => {
    setSoundError('')
    if (soundEnabled && soundReady) {
      setSoundEnabled(false)
      setSoundReady(false)
      writePreference(soundPreference, 'false')
      return
    }
    try {
      const context = getSirenContext()
      await context.resume()
      setSoundReady(context.state === 'running')
      setSoundEnabled(true)
      writePreference(soundPreference, 'true')
    } catch {
      setSoundError('Não foi possível ativar a sirene neste navegador.')
    }
  }

  return { announcement, error, synced, lastSync, sound: { enabled: soundEnabled && soundReady, toggle: toggleSound, error: soundError } }
}
