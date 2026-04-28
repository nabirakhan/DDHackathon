import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { wsClient } from '../lib/wsClient'
import { supabase } from '../lib/supabase'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

interface EventRow {
  id: number | string
  event_type: string
  node_id: string | null
  timestamp: string
}

const typeColor: Record<string, string> = {
  'node:created': '#84A98C',
  'node:updated': '#52796F',
  'node:deleted': '#ef4444',
  'decision:locked': '#fbbf24',
  'task:created': '#CAD2C5',
  'permission_denied': '#f97316',
}

const typeLabel: Record<string, string> = {
  'node:created': 'create',
  'node:updated': 'edit',
  'node:deleted': 'delete',
  'decision:locked': 'locked',
  'task:created': 'task',
  'permission_denied': 'denied',
}

export function EventLog({ roomId }: { roomId: string }) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) return
      fetch(`${SERVER_URL}/rooms/${roomId}/events?limit=50`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(json => {
          if (cancelled) return
          const rows: EventRow[] = (json.events ?? []).map((e: any) => ({
            id: e.id,
            event_type: e.event_type,
            node_id: e.node_id,
            timestamp: e.timestamp,
          }))
          setEvents(rows)
        })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [roomId])

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'mutation:broadcast' && msg.payload.eventType) {
        const eventType = msg.payload.eventType
        const nodeId = msg.payload.nodeId
        setEvents((prev: EventRow[]) => [
          { id: Date.now() + Math.random(), event_type: eventType, node_id: nodeId, timestamp: new Date().toISOString() },
          ...prev,
        ].slice(0, 100))
      }
      if (msg.type === 'node:decision_locked') {
        setEvents((prev: EventRow[]) => [
          { id: Date.now() + Math.random(), event_type: 'decision:locked', node_id: msg.payload.nodeId, timestamp: new Date().toISOString() },
          ...prev,
        ].slice(0, 100))
      }
      if (msg.type === 'task:created') {
        setEvents((prev: EventRow[]) => [
          { id: Date.now() + Math.random(), event_type: 'task:created', node_id: msg.payload.task.source_node_id, timestamp: new Date().toISOString() },
          ...prev,
        ].slice(0, 100))
      }
    })
  }, [])

  return (
    <div style={{
      width: '264px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(47, 62, 70, 0.65)',
      backdropFilter: 'blur(40px) saturate(150%)',
      WebkitBackdropFilter: 'blur(40px) saturate(150%)',
      border: '1px solid rgba(202, 210, 197, 0.08)',
      borderRadius: '2rem',
      boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
          borderBottom: '1px solid rgba(202,210,197,0.06)', flexShrink: 0,
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#84A98C', display: 'inline-block', animation: 'spin-slow 4s linear infinite' }} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '10px', fontWeight: 800, color: '#84A98C', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
          Intelligence
        </span>
        {events.length > 0 && (
          <span style={{ padding: '1px 6px', borderRadius: '999px', background: 'rgba(132,169,140,0.15)', border: '1px solid rgba(132,169,140,0.25)', fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 600, color: '#84A98C' }}>
            {events.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: 'rgba(202,210,197,0.3)', fontSize: '9px' }}>{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div ref={listRef} className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {events.length === 0 ? (
            <div style={{ padding: '28px 20px', fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(202,210,197,0.3)', textAlign: 'center', lineHeight: 1.6 }}>
              Awaiting activity...
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {events.map((e: EventRow) => {
                const color = typeColor[e.event_type] ?? '#84A98C'
                const label = typeLabel[e.event_type] ?? e.event_type
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -8, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ padding: '8px 16px 8px 20px', borderBottom: '1px solid rgba(202,210,197,0.04)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 600, color }}>
                        {label}
                      </span>
                      {e.node_id && (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'rgba(202,210,197,0.3)' }}>
                          #{e.node_id.slice(-6)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'rgba(202,210,197,0.25)', marginTop: '2px', paddingLeft: '10px' }}>
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  )
}