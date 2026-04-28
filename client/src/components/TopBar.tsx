// client/src/components/TopBar.tsx
import { useRoomJoinedState } from '../hooks/useRoomJoinedState'
import { useConnectionStatus } from '../hooks/useConnectionStatus'
import { useEffect, useState } from 'react'
import { wsClient } from '../lib/wsClient'
import { getDisplayName } from '../hooks/useAuth'
import { Wifi, WifiOff, RefreshCw, Clock, CheckSquare, Zap } from 'lucide-react'

const pill = (bg: string, border: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '5px',
  padding: '3px 10px', borderRadius: '999px',
  background: bg, border: `1px solid ${border}`,
})

function WsIndicator() {
  const status = useConnectionStatus()
  if (status === 'connected') return (
    <div style={pill('rgba(82,121,111,0.2)', 'rgba(132,169,140,0.35)')}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#84A98C', display: 'inline-block', animation: 'spin-slow 3s linear infinite' }} />
      <Wifi size={10} style={{ color: '#84A98C' }} />
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600, color: '#84A98C' }}>live</span>
    </div>
  )
  if (status === 'reconnecting') return (
    <div style={pill('rgba(251,191,36,0.12)', 'rgba(251,191,36,0.25)')}>
      <RefreshCw size={10} style={{ color: '#fbbf24', animation: 'spin 1s linear infinite' }} />
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600, color: '#fbbf24' }}>syncing</span>
    </div>
  )
  return (
    <div style={pill('rgba(239,68,68,0.12)', 'rgba(239,68,68,0.25)')}>
      <WifiOff size={10} style={{ color: '#ef4444' }} />
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600, color: '#ef4444' }}>offline</span>
    </div>
  )
}

export function TopBar({ roomId: _roomId }: { roomId: string }) {
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
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 20px', flexShrink: 0,
      background: 'rgba(47, 62, 70, 0.75)',
      backdropFilter: 'blur(40px) saturate(160%)',
      WebkitBackdropFilter: 'blur(40px) saturate(160%)',
      border: '1px solid rgba(202, 210, 197, 0.10)',
      borderRadius: '999px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 800, color: '#CAD2C5', letterSpacing: '-0.5px', marginRight: '4px' }}>
        LIGMA
      </span>

      <div style={{ width: '1px', height: '14px', background: 'rgba(202,210,197,0.15)' }} />

      {sessionStartedAt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={10} style={{ color: 'rgba(202,210,197,0.4)' }} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 500, color: 'rgba(202,210,197,0.7)' }}>
            {mins}m {secs}s
          </span>
        </div>
      )}

      <div style={pill('rgba(82,121,111,0.2)', 'rgba(82,121,111,0.3)')}>
        <CheckSquare size={10} style={{ color: '#52796F' }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600, color: '#84A98C' }}>
          {decisionCount} decisions
        </span>
      </div>

      <div style={pill('rgba(82,121,111,0.15)', 'rgba(132,169,140,0.25)')}>
        <Zap size={10} style={{ color: '#84A98C' }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600, color: '#84A98C' }}>
          {actionItems} tasks
        </span>
      </div>

      {showNudge && (
        <div style={pill('rgba(251,191,36,0.12)', 'rgba(251,191,36,0.25)')}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600, color: '#fbbf24' }}>⚠ needs decision</span>
        </div>
      )}

      {peerCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {Array.from({ length: Math.min(peerCount, 4) }).map((_, i) => (
            <div key={i} style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: `hsl(${(i * 55 + 160) % 360}, 35%, 42%)`,
              border: '2px solid rgba(47,62,70,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 700, color: '#CAD2C5',
              marginLeft: i > 0 ? '-7px' : '0',
            }}>
              {peerCount > 4 && i === 3 ? `+${peerCount - 3}` : name[0]?.toUpperCase()}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginLeft: 'auto' }} />
      <WsIndicator />
    </div>
  )
}
