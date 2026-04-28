// client/src/components/TaskBoard.tsx
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { wsClient } from '../lib/wsClient'
import { useEditor } from '../context/CanvasContext'
import type { TLShapeId } from 'tldraw'

interface Task {
  id: string
  source_node_id: string
  text: string
  author_id: string
  created_at: string
  room_id: string
}

export function TaskBoard({ roomId }: { roomId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const editor = useEditor()

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'task:created' && msg.payload.task.room_id === roomId) {
        setTasks(t => [...t, msg.payload.task as Task])
      }
    })
  }, [roomId])

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
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '10px', fontWeight: 800, color: '#84A98C', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
          Pipeline
        </span>
        {tasks.length > 0 && (
          <span style={{ padding: '1px 6px', borderRadius: '999px', background: 'rgba(132,169,140,0.15)', border: '1px solid rgba(132,169,140,0.25)', fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 600, color: '#84A98C' }}>
            {tasks.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: 'rgba(202,210,197,0.3)', fontSize: '9px' }}>{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '12px' }}>
          {tasks.length === 0 ? (
            <div style={{ padding: '24px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(202,210,197,0.3)', lineHeight: 1.6 }}>
                No tasks yet.
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(202,210,197,0.18)', marginTop: '4px' }}>
                Write "we need to..." on canvas
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {tasks.map((t, i) => (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => { editor?.select(t.source_node_id as TLShapeId); editor?.zoomToSelection() }}
                  style={{
                    display: 'block', width: '100%',
                    padding: '12px 14px', marginBottom: '8px',
                    background: 'rgba(53, 79, 82, 0.5)',
                    border: '1px solid rgba(202,210,197,0.07)',
                    borderLeft: '3px solid rgba(132,169,140,0.5)',
                    borderRadius: '1.25rem',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.2s ease',
                  }}
                  whileHover={{ backgroundColor: 'rgba(53,79,82,0.75)' }}
                >
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, color: '#CAD2C5', lineHeight: 1.5 }}>
                    {t.text}
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'rgba(202,210,197,0.3)', marginTop: '6px' }}>
                    {new Date(t.created_at).toLocaleTimeString()}
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  )
}
