import { useEffect, useState } from 'react'
import { trackPageEdits } from '../utils/pageEdits.js'
import { hasPendingWrites } from '../services/pendingWrites.js'

export default function useAppUpdates({ autoReload = true, enabled = true } = {}) {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    if (import.meta.env.DEV || !enabled) return
    let active = true, checking = false
    let controller
    let pendingVersion = ''
    const edits = trackPageEdits(document)
    const applyUpdate = () => {
      if (!active || !autoReload || !pendingVersion || document.hidden || navigator.onLine === false || hasPendingWrites() || edits.hasPendingChanges()) return
      const key = 'bolao:auto-update-attempt'
      try {
        if (window.sessionStorage.getItem(key) === pendingVersion) return
        window.sessionStorage.setItem(key, pendingVersion)
      } catch { return }
      window.location.reload()
    }
    const check = async () => {
      if (!active || checking || document.hidden || navigator.onLine === false) return
      checking = true
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 10000)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const version = await response.json()
        if (!active || typeof version.id !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(version.id)) return
        if (version.id === import.meta.env.VITE_APP_BUILD_ID) { pendingVersion = ''; setAvailable(false); return }
        setAvailable(true)
        pendingVersion = version.id
        applyUpdate()
      } catch { /* Missing manifests and offline devices keep their current screen. */ }
      finally { window.clearTimeout(timeout); checking = false }
    }
    check()
    const timer = window.setInterval(check, 60000)
    const idleTimer = window.setInterval(applyUpdate, 5000)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    return () => { active = false; controller?.abort(); edits.dispose(); window.clearInterval(timer); window.clearInterval(idleTimer); window.removeEventListener('online', check); document.removeEventListener('visibilitychange', check) }
  }, [autoReload, enabled])
  return available
}
