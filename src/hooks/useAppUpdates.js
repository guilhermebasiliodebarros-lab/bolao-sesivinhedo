import { useEffect, useState } from 'react'
import { startAppUpdates } from '../services/appUpdates.js'

export default function useAppUpdates({ autoReload = true, enabled = true } = {}) {
  const [available, setAvailable] = useState('')
  useEffect(() => {
    if (import.meta.env.DEV || !enabled) return
    return startAppUpdates({
      buildId: import.meta.env.VITE_APP_BUILD_ID,
      baseUrl: import.meta.env.BASE_URL,
      autoReload,
      onAvailable: setAvailable,
    })
  }, [autoReload, enabled])
  return available
}
