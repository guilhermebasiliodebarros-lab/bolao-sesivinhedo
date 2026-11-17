import { trackPageEdits } from '../utils/pageEdits.js'
import { hasPendingWrites } from './pendingWrites.js'

const validVersion = (id) => typeof id === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(id)
const versionParameter = 'app-version'

// A new URL also bypasses HTML cached before the current Hosting headers existed.
export function reloadAppVersion(id, win = globalThis.window) {
  if (!validVersion(id)) return
  const url = new URL(win.location.href)
  url.searchParams.set(versionParameter, id)
  win.location.replace(url.href)
}

export function startAppUpdates({ buildId, baseUrl = '/', autoReload = true, onAvailable, environment = {} }) {
  const win = environment.window ?? globalThis.window
  const doc = environment.document ?? globalThis.document
  const browser = environment.navigator ?? globalThis.navigator
  const request = environment.fetch ?? globalThis.fetch
  const edits = trackPageEdits(doc)
  let active = true, checking = false, controller, pendingVersion = '', attemptedVersion = ''
  const canCheck = () => active && !doc.hidden && browser.onLine !== false

  const applyUpdate = () => {
    if (!autoReload || !pendingVersion || !canCheck() || hasPendingWrites() || edits.hasPendingChanges()) return
    if (attemptedVersion === pendingVersion || new URL(win.location.href).searchParams.get(versionParameter) === pendingVersion) return
    const key = 'bolao:auto-update-attempt'
    try {
      if (win.sessionStorage.getItem(key) === pendingVersion) return
      win.sessionStorage.setItem(key, pendingVersion)
    } catch { /* Restricted storage must not disable updates; the URL also prevents loops. */ }
    attemptedVersion = pendingVersion
    reloadAppVersion(pendingVersion, win)
  }

  const check = async () => {
    if (checking || !canCheck()) return
    checking = true
    controller = new AbortController()
    const timeout = win.setTimeout(() => controller.abort(), 10000)
    try {
      const url = new URL(`${baseUrl}version.json`, win.location.href)
      url.searchParams.set('_check', String(Date.now()))
      const response = await request(url.href, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) return
      const version = await response.json()
      if (!active || !validVersion(version.id)) return
      pendingVersion = version.id === buildId ? '' : version.id
      onAvailable(pendingVersion)
      applyUpdate()
    } catch { /* Offline devices and missing manifests keep their current screen. */ }
    finally { win.clearTimeout(timeout); checking = false }
  }

  check()
  const timer = win.setInterval(check, 15000)
  const idleTimer = win.setInterval(applyUpdate, 5000)
  const events = ['online', 'focus', 'pageshow']
  events.forEach((event) => win.addEventListener(event, check))
  doc.addEventListener('visibilitychange', check)
  return () => {
    active = false
    controller?.abort()
    edits.dispose()
    win.clearInterval(timer)
    win.clearInterval(idleTimer)
    events.forEach((event) => win.removeEventListener(event, check))
    doc.removeEventListener('visibilitychange', check)
  }
}
