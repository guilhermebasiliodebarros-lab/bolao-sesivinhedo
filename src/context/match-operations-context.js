import { createContext } from 'react'

// Only the in-app test subtree overrides match operations. The rest of the app stays live.
export const MatchOperationsContext = createContext(null)
