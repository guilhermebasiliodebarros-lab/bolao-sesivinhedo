import { useEffect, useState } from 'react'
import { automaticPredictionDeadline } from '../utils/predictionDeadline.js'

export default function usePredictionClock(games) {
  const [now, setNow] = useState(() => new Date())
  const nextDeadline = games.reduce((next, game) => {
    const deadline = automaticPredictionDeadline(game)?.getTime()
    return deadline > now.getTime() ? Math.min(next, deadline) : next
  }, Infinity)

  useEffect(() => {
    let timer
    const refresh = () => {
      window.clearTimeout(timer)
      const current = new Date()
      setNow(current)
      const untilDeadline = nextDeadline - current.getTime()
      timer = window.setTimeout(refresh, untilDeadline > 0 ? Math.min(30000, untilDeadline) : 30000)
    }
    timer = window.setTimeout(refresh, 0)
    const onVisible = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', refresh) }
  }, [nextDeadline])

  return now
}
