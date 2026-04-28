// client/src/components/EventLog.tsx
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { wsClient } from '../lib/wsClient'
import { Activity } from 'lucide-react'

interface EventRow {
  id: number
  event_type: string
  user_id: string
  node_id: string | null
  timestamp: string
}

const typeColor: Record<string, string> = {
  'node:updated': '#8B8680',
  'decision:locked': '#5B7A9E',
  'task:created': '#D4A017',
}

const typeLabel: Record<string, string> = {
  'node:updated': 'edit',
  'decision:locked': 'locked',
  'task:created': 'task',
}

export function EventLog({ roomId: _roomId }: { roomId: string }) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return wsClient.on((msg) => {
      const add = (type: string, nodeId: string | null = null, userId = '') => {
        setEvents(e => [{
          id: Date.now() + Math.random(),
          event_type: type,
          user_id: userId,
          node_id: nodeId,
          timestamp: new Date().toISOString()
        }, ...e].slice(0, 100))
      }

      if (msg.type === 'mutation:broadcast') add('node:updated', msg.payload.nodeId)
      if (msg.type === 'node:decision_locked') add('decision:locked', msg.payload.nodeId)
      if (msg.type === 'task:created') add('task:created', msg.payload.task.source_node_id, msg.payload.task.author_id)
    })
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: '72px',
      left: '16px',
      width: '220px',
      maxHeight: collapsed ? '48px' : '420px',
      background: 'rgba(28, 24, 20, 0.78)',
      backdropFilter: 'contrast(110%) blur(20px)',
      WebkitBackdropFilter: 'contrast(110%) blur(20px)',
      border: '1px solid rgba(200, 188, 168, 0.15)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: 40,
      overflow: 'hidden',
      transition: 'max-height 0.3s ease',
    }}>
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid rgba(200, 188, 168, 0.08)',
        }}
      >
        <Activity size={13} style={{ color: '#8B8680' }} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '12px', fontWeight: 700, color: '#C8BCA8', letterSpacing: '0.5px' }}>
          Event Log
        </span>
        {events.length > 0 && (
          <span style={{
            marginLeft: 'auto',
            padding: '1px 6px',
            borderRadius: '999px',
            background: 'rgba(184, 134, 11, 0.2)',
            border: '1px solid rgba(184, 134, 11, 0.3)',
            fontFamily: 'DM Mono, monospace',
            fontSize: '9px',
            color: '#D4A017',
          }}>
            {events.length}
          </span>
        )}
        <span style={{ marginLeft: events.length > 0 ? '0' : 'auto', color: '#8B8680', fontSize: '10px' }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </button>

      {!collapsed && (
        <div
          ref={listRef}
          style={{ overflowY: 'auto', maxHeight: '372px', padding: '8px 0' }}
        >
          {events.length === 0 ? (
            <div style={{ padding: '16px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#8B8680', textAlign: 'center' }}>
              No events yet.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {events.map(e => {
                const color = typeColor[e.event_type] ?? '#8B8680'
                const label = typeLabel[e.event_type] ?? e.event_type
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -8, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ padding: '6px 16px', borderBottom: '1px solid rgba(200, 188, 168, 0.04)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '6px', height: '6px',
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                      }} />
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color, fontWeight: 500 }}>
                        {label}
                      </span>
                      {e.node_id && (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8B8680' }}>
                          #{e.node_id.slice(0, 6)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8B8680', marginTop: '1px', paddingLeft: '12px' }}>
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
