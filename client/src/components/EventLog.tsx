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
      top: '80px',
      left: '16px',
      width: '252px',
      maxHeight: collapsed ? '52px' : 'calc(100vh - 180px)',
      background: 'rgba(17, 19, 21, 0.82)',
      backdropFilter: 'contrast(115%) blur(28px)',
      WebkitBackdropFilter: 'contrast(115%) blur(28px)',
      border: '1px solid rgba(255, 255, 255, 0.07)',
      borderRadius: '28px',
      boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset',
      zIndex: 40,
      overflow: 'hidden',
      transition: 'max-height 0.35s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          width: '100%', padding: '16px 20px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <Activity size={12} style={{ color: '#A07D54' }} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '10px', fontWeight: 800, color: '#A07D54', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
          Intelligence
        </span>
        {events.length > 0 && (
          <span style={{
            marginLeft: 'auto',
            padding: '2px 7px', borderRadius: '999px',
            background: 'rgba(160, 125, 84, 0.18)',
            border: '1px solid rgba(160, 125, 84, 0.3)',
            fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#A07D54',
          }}>
            {events.length}
          </span>
        )}
        <span style={{ marginLeft: events.length > 0 ? '0' : 'auto', color: '#8B8680', fontSize: '9px' }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </button>

      {!collapsed && (
        <div
          ref={listRef}
          className="custom-scrollbar"
          style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)', padding: '8px 0' }}
        >
          {events.length === 0 ? (
            <div style={{ padding: '24px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#8B8680', textAlign: 'center', lineHeight: 1.6 }}>
              Awaiting activity...
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
                    style={{
                      padding: '8px 20px',
                      borderLeft: `2px solid ${color}40`,
                      marginLeft: '12px',
                      marginBottom: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        display: 'inline-block', width: '5px', height: '5px',
                        borderRadius: '50%', background: color, flexShrink: 0,
                      }} />
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color, fontWeight: 500 }}>
                        {label}
                      </span>
                      {e.node_id && (
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'rgba(139,134,128,0.6)' }}>
                          #{e.node_id.slice(0, 6)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#8B8680', marginTop: '2px', paddingLeft: '11px' }}>
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
