// client/src/components/ContestedNodeOverlay.tsx
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { wsClient } from '../lib/wsClient'
import { Swords } from 'lucide-react'
import { useMyRole } from '../hooks/useMyRole'

interface Contest {
  nodeId: string
  versions: Record<string, string>
}

export function ContestedNodeOverlay({ roomId }: { roomId: string }) {
  const [contests, setContests] = useState<Map<string, Contest>>(new Map())
  const { role } = useMyRole(roomId)

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'node:contested') {
        setContests(m => new Map(m).set(msg.payload.nodeId, msg.payload))
      }
      if (msg.type === 'node:decision_locked') {
        toast.success(`Decision locked on #${msg.payload.nodeId.slice(-6)}`, { duration: 4000 })
        setContests(m => { const n = new Map(m); n.delete(msg.payload.nodeId); return n })
      }
    })
  }, [])

  if (contests.size === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '96px',
      right: '16px',
      width: '280px',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <AnimatePresence>
        {Array.from(contests.values()).map(c => (
          <motion.div
            key={c.nodeId}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              background: 'rgba(28, 24, 20, 0.88)',
              backdropFilter: 'contrast(110%) blur(20px)',
              WebkitBackdropFilter: 'contrast(110%) blur(20px)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '14px',
              padding: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(251,191,36,0.1)',
              animation: 'vibrate 0.4s ease-in-out infinite',
              animationDelay: '0.5s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{
                padding: '4px',
                borderRadius: '8px',
                background: 'rgba(251, 191, 36, 0.15)',
                border: '1px solid rgba(251,191,36,0.3)',
              }}>
                <Swords size={13} style={{ color: '#fbbf24' }} />
              </div>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>
                Contested
              </span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8B8680', marginLeft: 'auto' }}>
                #{c.nodeId.slice(0, 6)}
              </span>
            </div>

            <div style={{ marginBottom: '12px' }}>
              {Object.entries(c.versions).map(([userId, text]) => (
                <button
                  key={userId}
                  onClick={() => wsClient.send({
                    type: 'vote:cast',
                    payload: { roomId, nodeId: c.nodeId, votedForUserId: userId }
                  })}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginBottom: '6px',
                    padding: '8px 10px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px dashed rgba(251, 191, 36, 0.25)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLButtonElement).style.background = 'rgba(251,191,36,0.08)'
                    ;(e.target as HTMLButtonElement).style.borderColor = 'rgba(251,191,36,0.5)'
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'
                    ;(e.target as HTMLButtonElement).style.borderColor = 'rgba(251,191,36,0.25)'
                  }}
                >
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8B8680', marginBottom: '3px' }}>
                    {userId.slice(0, 8)}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#E8E0D0' }}>
                    {text}
                  </div>
                </button>
              ))}
            </div>

            {role === 'lead' && (
              <button
                onClick={() => wsClient.send({
                  type: 'decision:lock',
                  payload: { roomId, nodeId: c.nodeId }
                })}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  background: 'linear-gradient(135deg, #3E5974, #5D5646)',
                  border: '1px solid rgba(200, 188, 168, 0.15)',
                  borderRadius: '999px',
                  color: '#E8E0D0',
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.5px',
                }}
              >
                Lock Decision
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
