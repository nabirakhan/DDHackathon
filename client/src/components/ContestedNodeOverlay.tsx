import { useEffect, useState } from 'react'
import { wsClient } from '../lib/wsClient'

interface Contest {
  nodeId: string
  versions: Record<string, string>
}

export function ContestedNodeOverlay({ roomId }: { roomId: string }) {
  const [contests, setContests] = useState<Map<string, Contest>>(new Map())

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'node:contested') {
        setContests(m => new Map(m).set(msg.payload.nodeId, msg.payload))
      }
      if (msg.type === 'node:decision_locked') {
        setContests(m => { const n = new Map(m); n.delete(msg.payload.nodeId); return n })
      }
    })
  }, [])

  if (contests.size === 0) return null

  return (
    <div className="fixed bottom-4 right-80 w-96 bg-white border-2 border-amber-500 rounded-lg p-4 shadow-xl z-50">
      <h4 className="font-bold text-amber-700 mb-3">⚡ Contested Nodes</h4>
      {Array.from(contests.values()).map(c => (
        <div key={c.nodeId} className="mb-4 border-b pb-4 last:border-0 last:pb-0">
          <p className="text-xs text-slate-500 mb-2">Node: {c.nodeId.slice(0, 8)}</p>
          {Object.entries(c.versions).map(([userId, text]) => (
            <button
              key={userId}
              onClick={() => wsClient.send({
                type: 'vote:cast',
                payload: { roomId, nodeId: c.nodeId, votedForUserId: userId }
              })}
              className="block w-full text-left p-2 my-1 border rounded hover:bg-amber-50 transition-colors"
            >
              <div className="text-xs text-slate-500">{userId.slice(0, 8)}</div>
              <div className="text-sm font-medium">{text}</div>
            </button>
          ))}
          <button
            onClick={() => wsClient.send({
              type: 'decision:lock',
              payload: { roomId, nodeId: c.nodeId }
            })}
            className="mt-2 w-full p-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium transition-colors"
          >
            Lock as Decision (Lead only)
          </button>
        </div>
      ))}
    </div>
  )
}
