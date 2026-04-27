import { useEffect, useState, useCallback } from 'react'
import { throttle } from 'lodash'
import { wsClient } from '../lib/wsClient'
import { useAuth } from '../hooks/useAuth'
import type { AwarenessState } from '@shared/types'

interface PeerCursor extends AwarenessState { userId: string }

function stringToColor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 70%, 50%)`
}

export function CursorPresence({ roomId: _roomId }: { roomId: string }) {
  const { user } = useAuth()
  const [peers, setPeers] = useState<Map<string, PeerCursor>>(new Map())

  const broadcast = useCallback(
    throttle((cursor: { x: number; y: number }) => {
      wsClient.send({
        type: 'awareness:update',
        payload: {
          cursor,
          name: user?.email?.split('@')[0] ?? 'anon',
          color: stringToColor(user?.id ?? 'a')
        }
      })
    }, 100),
    [user]
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => broadcast({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [broadcast])

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'awareness:broadcast') {
        setPeers(p => new Map(p).set(msg.payload.userId, msg.payload as PeerCursor))
      }
      if (msg.type === 'awareness:peer_left') {
        setPeers(p => { const n = new Map(p); n.delete(msg.payload.userId); return n })
      }
      if (msg.type === 'room:joined') {
        const m = new Map<string, PeerCursor>()
        msg.payload.awarenessStates.forEach(s => m.set(s.userId, s as PeerCursor))
        setPeers(m)
      }
    })
  }, [])

  return (
    <>
      {Array.from(peers.values()).map(p => (
        <div
          key={p.userId}
          className="fixed pointer-events-none z-40"
          style={{ left: p.cursor.x, top: p.cursor.y, color: p.color }}
        >
          ▲
          <span
            className="ml-1 px-1 text-xs text-white rounded"
            style={{ background: p.color }}
          >
            {p.name}
          </span>
        </div>
      ))}
    </>
  )
}
