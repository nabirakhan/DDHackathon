import { useEffect, useState } from 'react'
import { useRoomJoinedState } from '../hooks/useRoomJoinedState'
import { wsClient } from '../lib/wsClient'

export function SessionHealthBar() {
  const { sessionStartedAt, decisionCount } = useRoomJoinedState()
  const [now, setNow] = useState(Date.now())
  const [actionItems, setActionItems] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'task:created') setActionItems(c => c + 1)
    })
  }, [])

  const elapsed = sessionStartedAt ? now - new Date(sessionStartedAt).getTime() : 0
  const showNudge = elapsed > 30_000 && decisionCount === 0

  return (
    <div className="flex gap-4 p-2 border-b bg-slate-50 text-sm items-center">
      <span className="font-medium">Decisions: <strong>{decisionCount}</strong></span>
      <span className="font-medium">Action Items: <strong>{actionItems}</strong></span>
      {sessionStartedAt && (
        <span className="text-slate-500">
          Session: {Math.floor(elapsed / 60_000)}m {Math.floor((elapsed % 60_000) / 1000)}s
        </span>
      )}
      {showNudge && (
        <span className="text-amber-600 font-semibold">⚠ Session needs a decision</span>
      )}
    </div>
  )
}
