import { useEffect, useState } from 'react'

export default function useBroadcastScreen() {
  const [now, setNow] = useState(() => new Date())
  const [online, setOnline] = useState(() => navigator.onLine !== false)
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement))
  const [message, setMessage] = useState('')

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000)
    const network = () => { setOnline(navigator.onLine !== false); setNow(new Date()) }
    const screen = () => setFullscreen(Boolean(document.fullscreenElement))
    window.addEventListener('online', network)
    window.addEventListener('offline', network)
    document.addEventListener('fullscreenchange', screen)
    return () => {
      window.clearInterval(clock)
      window.removeEventListener('online', network)
      window.removeEventListener('offline', network)
      document.removeEventListener('fullscreenchange', screen)
    }
  }, [])

  useEffect(() => {
    let active = true
    let acquiring = false
    let lock
    const keepAwake = async () => {
      if (document.visibilityState !== 'visible') { lock?.release().catch(() => {}); return }
      if (!navigator.wakeLock || acquiring || (lock && !lock.released)) return
      acquiring = true
      try {
        const next = await navigator.wakeLock.request('screen')
        if (!active || document.visibilityState !== 'visible') await next.release()
        else lock = next
      } catch { /* The display also works on TVs without the screen wake-lock API. */ }
      finally { acquiring = false }
    }
    keepAwake()
    document.addEventListener('visibilitychange', keepAwake)
    return () => { active = false; document.removeEventListener('visibilitychange', keepAwake); lock?.release().catch(() => {}) }
  }, [])

  const toggleFullscreen = async () => {
    setMessage('')
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen()
      else setMessage('Ative a tela cheia no menu do navegador da TV.')
    } catch { setMessage('Ative a tela cheia no menu do navegador da TV.') }
  }

  return { now, online, fullscreen, toggleFullscreen, message }
}
