import { useEffect } from 'react'

export default function useSearchFocus(id, ready, prefix) {
  useEffect(() => {
    if (!id || !ready) return
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(`${prefix}${id}`)
      target?.scrollIntoView({ block: 'start', behavior: 'instant' })
      target?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [id, ready, prefix])
}
