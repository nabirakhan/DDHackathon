import { useRoomJoinedState } from '../hooks/useRoomJoinedState'
import { useConnectionStatus } from '../hooks/useConnectionStatus'
import { useEffect, useState } from 'react'
import { wsClient } from '../lib/wsClient'
import { getDisplayName } from '../hooks/useAuth'
import { Wifi, WifiOff, RefreshCw, Clock, CheckSquare, Zap } from 'lucide-react'

interface Props {
  roomId: string
}

function WsIndicator() {
  const status = useConnectionStatus()
  if (status === 'connected') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(74, 222, 128, 0.12)', border: '1px solid rgba(74, 222, 128, 0.25)' }}>
      <Wifi size={11} style={{ color: '#4ade80' }} />
      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#4ade80' }}>live</span>
    </div>
  )
  if (status === 'reconnecting') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.25)' }}>
      <RefreshCw size={11} style={{ color: '#fbbf24', animation: 'spin 1s linear infinite' }} />
      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#fbbf24' }}>reconnecting</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
      <WifiOff size={11} style={{ color: '#ef4444' }} />
      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#ef4444' }}>offline</span>
    </div>
  )
}

export function TopBar({ roomId: _roomId }: Props) {
  const { sessionStartedAt, decisionCount } = useRoomJoinedState()
  const [now, setNow] = useState(Date.now())
  const [actionItems, setActionItems] = useState(0)
  const [peerCount, setPeerCount] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'task:created') setActionItems(c => c + 1)
      if (msg.type === 'room:joined') setPeerCount(msg.payload.awarenessStates.length)
      if (msg.type === 'awareness:broadcast') setPeerCount(c => Math.max(c, 1))
      if (msg.type === 'awareness:peer_left') setPeerCount(c => Math.max(0, c - 1))
    })
  }, [])

  const elapsed = sessionStartedAt ? now - new Date(sessionStartedAt).getTime() : 0
  const mins = Math.floor(elapsed / 60_000)
  const secs = Math.floor((elapsed % 60_000) / 1000)
  const showNudge = elapsed > 30_000 && decisionCount === 0

  const name = getDisplayName()

  return (
    <div style={{
      position: 'fixed',
      top: '14px',
      left: '284px',
      right: '284px',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 20px',
      background: 'rgba(17, 19, 21, 0.88)',
      backdropFilter: 'contrast(115%) blur(28px)',
      WebkitBackdropFilter: 'contrast(115%) blur(28px)',
      border: '1px solid rgba(255, 255, 255, 0.07)',
      borderRadius: '999px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset',
      whiteSpace: 'nowrap',
    }}>
      {/* LIGMA logo */}
      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: 800, color: '#E8E0D0', letterSpacing: '-0.3px', marginRight: '4px' }}>
        LIGMA
      </span>

      <div style={{ width: '1px', height: '16px', background: 'rgba(200, 188, 168, 0.15)' }} />

      {/* Session timer */}
      {sessionStartedAt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={11} style={{ color: '#8B8680' }} />
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#C8BCA8' }}>
            {mins}m {secs}s
          </span>
        </div>
      )}

      {/* Decisions pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '999px', background: 'rgba(62, 89, 116, 0.25)', border: '1px solid rgba(62, 89, 116, 0.3)' }}>
        <CheckSquare size={11} style={{ color: '#5B7A9E' }} />
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#5B7A9E' }}>
          {decisionCount} decisions
        </span>
      </div>

      {/* Action items pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '999px', background: 'rgba(184, 134, 11, 0.15)', border: '1px solid rgba(184, 134, 11, 0.25)' }}>
        <Zap size={11} style={{ color: '#D4A017' }} />
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#D4A017' }}>
          {actionItems} tasks
        </span>
      </div>

      {/* Nudge */}
      {showNudge && (
        <div style={{ padding: '3px 9px', borderRadius: '999px', background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.25)' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#fbbf24' }}>
            ⚠ needs decision
          </span>
        </div>
      )}

      {/* Peer count */}
      {peerCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {Array.from({ length: Math.min(peerCount, 4) }).map((_, i) => (
            <div key={i} style={{
              width: '22px', height: '22px',
              borderRadius: '50%',
              background: `hsl(${(i * 60 + 180) % 360}, 40%, 45%)`,
              border: '2px solid rgba(28, 24, 20, 0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#E8E0D0',
              marginLeft: i > 0 ? '-8px' : '0',
            }}>
              {peerCount > 4 && i === 3 ? `+${peerCount - 3}` : name[0]?.toUpperCase()}
            </div>
          ))}
        </div>
      )}

      <div style={{ width: '1px', height: '16px', background: 'rgba(200, 188, 168, 0.15)' }} />

      <WsIndicator />
    </div>
  )
}
