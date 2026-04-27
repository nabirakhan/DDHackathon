import { useEffect, useState } from 'react'
import { wsClient } from '../lib/wsClient'

interface EventRow {
  id: number
  event_type: string
  user_id: string
  node_id: string | null
  timestamp: string
}

export function EventLog({ roomId: _roomId }: { roomId: string }) {
  const [events, setEvents] = useState<EventRow[]>([])

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'mutation:broadcast') {
        setEvents(e => [{
          id: Date.now(),
          event_type: 'node:updated',
          user_id: '',
          node_id: msg.payload.nodeId,
          timestamp: new Date().toISOString()
        }, ...e].slice(0, 100))
      }
      if (msg.type === 'node:decision_locked') {
        setEvents(e => [{
          id: Date.now(),
          event_type: 'decision:locked',
          user_id: '',
          node_id: msg.payload.nodeId,
          timestamp: new Date().toISOString()
        }, ...e].slice(0, 100))
      }
      if (msg.type === 'task:created') {
        setEvents(e => [{
          id: Date.now(),
          event_type: 'task:created',
          user_id: msg.payload.task.author_id,
          node_id: msg.payload.task.source_node_id,
          timestamp: msg.payload.task.created_at
        }, ...e].slice(0, 100))
      }
    })
  }, [])

  return (
    <aside className="w-64 border-r p-4 overflow-y-auto bg-white">
      <h3 className="font-semibold mb-3 text-slate-800">Event Log</h3>
      {events.length === 0 && (
        <p className="text-xs text-slate-400">No events yet.</p>
      )}
      {events.map(e => (
        <div key={e.id} className="text-xs mb-2 border-b pb-1">
          <span className={`font-mono font-medium ${
            e.event_type === 'decision:locked' ? 'text-green-600' :
            e.event_type === 'task:created' ? 'text-blue-600' : 'text-slate-600'
          }`}>
            {e.event_type}
          </span>
          {e.node_id && (
            <span className="text-slate-400 ml-1">{e.node_id.slice(0, 8)}</span>
          )}
          <div className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</div>
        </div>
      ))}
    </aside>
  )
}
