import { useContext } from 'react'
import { MatchOperationsContext } from './match-operations-context.js'
import * as liveOperations from '../services/bolaoService.js'

export function useMatchOperations() {
  return useContext(MatchOperationsContext) || liveOperations
}
