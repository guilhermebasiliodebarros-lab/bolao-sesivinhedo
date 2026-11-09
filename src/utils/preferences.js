// Optional display preferences must not prevent the site from opening.
export function readPreference(key, fallback = null) {
  try { return window.localStorage.getItem(key) ?? fallback } catch { return fallback }
}

export function writePreference(key, value) {
  try { window.localStorage.setItem(key, String(value)); return true } catch { return false }
}
