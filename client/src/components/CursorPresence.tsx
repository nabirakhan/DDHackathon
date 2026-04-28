// client/src/components/CursorPresence.tsx
import { useEffect, useState, useCallback } from 'react'
import { throttle } from 'lodash'
import { motion, AnimatePresence } from 'framer-motion'
import { wsClient } from '../lib/wsClient'
import { useAuth } from '../hooks/useAuth'
import type { AwarenessState } from '@shared/types'

interface PeerCursor extends AwarenessState { userId: string }

const ROLE_RING: Record<string, { ring: string; double: boolean }> = {
  lead: { ring: '#5B7A9E', double: true },
  contributor: { ring: '#B8860B', double: false },
  viewer: { ring: '#8B8680', double: false },
}

function stringToColor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 45%, 55%)`
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
      <AnimatePresence>
        {Array.from(peers.values()).map(p => {
          const roleRing = ROLE_RING[(p as PeerCursor & { role?: string }).role ?? 'viewer'] ?? ROLE_RING.viewer
          return (
            <motion.div
              key={p.userId}
              className="fixed pointer-events-none"
              style={{ left: p.cursor.x, top: p.cursor.y, zIndex: 40 }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div style={{ position: 'relative' }}>
                <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                  <path d="M0 0 L0 16 L5 12 L8 20 L10 19 L7 11 L14 11 Z"
                    fill={roleRing.ring}
                    stroke="rgba(28,24,20,0.8)"
                    strokeWidth="1"
                  />
                </svg>

                <div style={{
                  position: 'absolute',
                  top: '-4px', left: '-4px',
                  width: '24px', height: '24px',
                  borderRadius: '50%',
                  border: `2px solid ${roleRing.ring}`,
                  opacity: 0.5,
                  animation: 'spin-slow 6s linear infinite',
                }} />
                {roleRing.double && (
                  <div style={{
                    position: 'absolute',
                    top: '-8px', left: '-8px',
                    width: '32px', height: '32px',
                    borderRadius: '50%',
                    border: `1px solid ${roleRing.ring}`,
                    opacity: 0.25,
                    animation: 'spin-slow 10s linear infinite reverse',
                  }} />
                )}

                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '12px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(28, 24, 20, 0.85)',
                  border: `1px solid ${roleRing.ring}44`,
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  color: roleRing.ring,
                  whiteSpace: 'nowrap',
                  backdropFilter: 'blur(4px)',
                }}>
                  {p.name}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </>
  )
}
