// client/src/components/TopBar.tsx
import { useRoomJoinedState } from '../hooks/useRoomJoinedState'
import { useConnectionStatus } from '../hooks/useConnectionStatus'
import { useEffect, useRef, useState } from 'react'
import { wsClient } from '../lib/wsClient'
import { supabase } from '../lib/supabase'
import { getDisplayName, useAuth } from '../hooks/useAuth'
import { useMyRole } from '../hooks/useMyRole'
import { Wifi, WifiOff, RefreshCw, Clock, CheckSquare, Zap, Users } from 'lucide-react'
import type { UserRole } from '@shared/types'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

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

interface Member { user_id: string; role: UserRole }

function MembersPanel({ roomId, myRole, myUserId, onClose }: {
  roomId: string
  myRole: UserRole | null
  myUserId: string | null
  onClose: () => void
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [peerNames, setPeerNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchMembers = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`${SERVER_URL}/rooms/${roomId}/members`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) return
    const { members: data } = await res.json()
    setMembers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchMembers() }, [roomId])

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'awareness:broadcast') {
        setPeerNames(m => new Map(m).set(msg.payload.userId, msg.payload.name))
      }
      if (msg.type === 'role:changed') {
        setMembers(ms => ms.map(m => m.user_id === msg.payload.userId ? { ...m, role: msg.payload.newRole } : m))
      }
    })
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  const changeRole = async (targetUserId: string, newRole: UserRole) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`${SERVER_URL}/rooms/${roomId}/members/${targetUserId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ role: newRole }),
    })
    if (!res.ok) console.error('[members] role change failed', res.status)
    // WS broadcast will update local state via role:changed
  }

  const roleBadgeStyle = (role: UserRole): React.CSSProperties => {
    const colors: Record<UserRole, [string, string]> = {
      lead: ['rgba(91,122,158,0.25)', '#5B7A9E'],
      contributor: ['rgba(184,134,11,0.2)', '#B8860B'],
      viewer: ['rgba(139,134,128,0.2)', '#8B8680'],
    }
    const [bg, color] = colors[role]
    return { padding: '2px 8px', borderRadius: '999px', background: bg, border: `1px solid ${color}44`, fontFamily: 'DM Mono, monospace', fontSize: '9px', color, whiteSpace: 'nowrap' }
  }

  return (
    <div ref={panelRef} style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
      width: '260px', zIndex: 100,
      background: 'rgba(47, 62, 70, 0.95)',
      backdropFilter: 'blur(40px) saturate(160%)',
      WebkitBackdropFilter: 'blur(40px) saturate(160%)',
      border: '1px solid rgba(202,210,197,0.12)',
      borderRadius: '1.25rem',
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      padding: '12px',
    }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '10px', fontWeight: 800, color: '#84A98C', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', padding: '0 4px' }}>
        Members
      </div>
      {loading ? (
        <div style={{ padding: '12px 4px', fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(202,210,197,0.3)' }}>Loading…</div>
      ) : members.map(m => {
        const name = m.user_id === myUserId
          ? getDisplayName()
          : (peerNames.get(m.user_id) ?? m.user_id.slice(0, 10) + '…')
        const isMe = m.user_id === myUserId
        return (
          <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 4px', borderBottom: '1px solid rgba(202,210,197,0.05)' }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
              background: `hsl(${m.user_id.charCodeAt(0) * 7 % 360}, 35%, 42%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 700, color: '#CAD2C5',
            }}>
              {name[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 600, color: '#CAD2C5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}{isMe && <span style={{ color: 'rgba(202,210,197,0.35)', fontWeight: 400 }}> (you)</span>}
              </div>
            </div>
            {myRole === 'lead' && !isMe && m.role !== 'lead' ? (
              <select
                value={m.role}
                onChange={e => changeRole(m.user_id, e.target.value as UserRole)}
                style={{
                  background: 'rgba(47,62,70,0.8)', border: '1px solid rgba(202,210,197,0.15)',
                  borderRadius: '6px', color: '#CAD2C5', fontFamily: 'DM Mono, monospace',
                  fontSize: '9px', padding: '2px 4px', cursor: 'pointer',
                }}
              >
                <option value="contributor">contributor</option>
                <option value="viewer">viewer</option>
              </select>
            ) : (
              <span style={roleBadgeStyle(m.role)}>{m.role}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function TopBar({ roomId }: { roomId: string }) {
  const { sessionStartedAt, decisionCount } = useRoomJoinedState()
  const [now, setNow] = useState(Date.now())
  const [actionItems, setActionItems] = useState(0)
  const [peerCount, setPeerCount] = useState(0)
  const [showMembers, setShowMembers] = useState(false)
  const { role: myRole, userId: myUserId } = useMyRole(roomId)
  const { user } = useAuth()
  const name = getDisplayName()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'task:created') setActionItems(c => c + 1)
      if (msg.type === 'task:updated' && msg.payload.status === 'done') setActionItems(c => Math.max(0, c - 1))
      if (msg.type === 'room:joined') setPeerCount(msg.payload.awarenessStates.length)
      if (msg.type === 'awareness:broadcast') setPeerCount(c => Math.max(c, 1))
      if (msg.type === 'awareness:peer_left') setPeerCount(c => Math.max(0, c - 1))
    })
  }, [])

  const elapsed = sessionStartedAt ? now - new Date(sessionStartedAt).getTime() : 0
  const mins = Math.floor(elapsed / 60_000)
  const secs = Math.floor((elapsed % 60_000) / 1000)
  const showNudge = elapsed > 30_000 && decisionCount === 0

  return (
    <div style={{ position: 'relative' }}>
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

        <button
          onClick={() => setShowMembers(v => !v)}
          title="Members"
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', borderRadius: '999px', cursor: 'pointer',
            background: showMembers ? 'rgba(132,169,140,0.2)' : 'transparent',
            border: '1px solid rgba(132,169,140,0.2)',
            color: '#84A98C', transition: 'background 0.15s',
          }}
        >
          <Users size={10} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600 }}>
            {myRole ?? '…'}
          </span>
        </button>
      </div>

      {showMembers && (
        <MembersPanel
          roomId={roomId}
          myRole={myRole}
          myUserId={myUserId ?? user?.id ?? null}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  )
}
