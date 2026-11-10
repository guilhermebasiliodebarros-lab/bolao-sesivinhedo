import { useEffect, useState, useSyncExternalStore } from 'react'
import { getRealtimeStatus, subscribeRealtimeStatus } from '../services/realtimeStatus.js'

export default function ConnectionStatus() {
  const { state } = useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus)
  const [online, setOnline] = useState(() => navigator.onLine !== false)
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine !== false)
    window.addEventListener('online', changed)
    window.addEventListener('offline', changed)
    return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed) }
  }, [])
  const visibleState = online ? state : 'offline'
  if (visibleState === 'idle') return null
  const labels = { live: 'Atualizações em tempo real', offline: 'Sem internet · exibindo os últimos dados recebidos', reconnecting: 'Reconectando automaticamente · mantendo os últimos dados', syncing: 'Sincronizando com o servidor…' }
  return <div className={`site-connection site-connection-${visibleState}`} role="status"><span aria-hidden="true" />{labels[visibleState]}</div>
}
