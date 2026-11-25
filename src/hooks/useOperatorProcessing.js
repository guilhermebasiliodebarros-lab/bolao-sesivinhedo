import { useEffect } from 'react'
import { startOperatorScoring } from '../services/operatorScoringService.js'
import { startOperatorRosters } from '../services/predictionRosterService.js'

export default function useOperatorProcessing(enabled, userId) {
  useEffect(() => {
    if (!enabled || !userId) return
    const stops = [startOperatorScoring(), startOperatorRosters()]
    return () => stops.forEach((stop) => stop())
  }, [enabled, userId])
}
