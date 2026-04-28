// client/src/components/TaskBoard.tsx
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { wsClient } from '../lib/wsClient'
import { useEditor } from '../context/CanvasContext'
import type { TLShapeId } from 'tldraw'
import { ListTodo } from 'lucide-react'

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
      position: 'fixed',
      top: '80px',
      right: '16px',
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
        <ListTodo size={12} style={{ color: '#D4A017' }} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '10px', fontWeight: 800, color: '#D4A017', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
          Pipeline
        </span>
        {tasks.length > 0 && (
          <span style={{
            marginLeft: 'auto',
            padding: '2px 7px', borderRadius: '999px',
            background: 'rgba(212, 160, 23, 0.15)',
            border: '1px solid rgba(212, 160, 23, 0.3)',
            fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#D4A017',
          }}>
            {tasks.length}
          </span>
        )}
        <span style={{ marginLeft: tasks.length > 0 ? '0' : 'auto', color: '#8B8680', fontSize: '9px' }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </button>

      {!collapsed && (
        <div className="custom-scrollbar" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)', padding: '12px' }}>
          {tasks.length === 0 ? (
            <div style={{ padding: '20px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#8B8680', lineHeight: 1.6 }}>
                No tasks yet.
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'rgba(139,134,128,0.5)', marginTop: '4px' }}>
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
                    background: 'rgba(248, 246, 242, 0.06)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: '3px solid rgba(212, 160, 23, 0.5)',
                    borderRadius: '14px',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.2s ease, border-color 0.2s ease',
                  }}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, color: '#E8E0D0', lineHeight: 1.5 }}>
                    {t.text}
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#8B8680', marginTop: '6px' }}>
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
