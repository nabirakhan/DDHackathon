// client/src/hooks/useRoomJoinedState.ts
import { useEffect, useState } from 'react'
import { wsClient } from '../lib/wsClient'

export function useRoomJoinedState() {
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null)
  const [decisionCount, setDecisionCount] = useState(0)

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'room:joined') {
        setSessionStartedAt(msg.payload.sessionStartedAt)
        setDecisionCount(msg.payload.decisionCount)
      }
      if (msg.type === 'node:decision_locked') {
        setDecisionCount(c => c + 1)
      }
    })
  }, [])

  return { sessionStartedAt, decisionCount }
}
