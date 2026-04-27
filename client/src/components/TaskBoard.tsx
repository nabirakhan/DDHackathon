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
      top: '72px',
      right: '16px',
      width: '240px',
      maxHeight: collapsed ? '48px' : '480px',
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
      {/* Header */}
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
        <ListTodo size={13} style={{ color: '#D4A017' }} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '12px', fontWeight: 700, color: '#C8BCA8', letterSpacing: '0.5px' }}>
          Action Items
        </span>
        {tasks.length > 0 && (
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
            {tasks.length}
          </span>
        )}
        <span style={{ marginLeft: tasks.length > 0 ? '0' : 'auto', color: '#8B8680', fontSize: '10px' }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </button>

      {/* Tasks */}
      {!collapsed && (
        <div style={{ overflowY: 'auto', maxHeight: '432px', padding: '8px' }}>
          {tasks.length === 0 ? (
            <div style={{ padding: '20px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#8B8680' }}>
                No tasks yet.
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8B8680', marginTop: '4px', opacity: 0.7 }}>
                Add "we need to..." text
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
                  whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.04)' }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 12px',
                    marginBottom: '6px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(200, 188, 168, 0.1)',
                    borderBottom: '2px solid rgba(184, 134, 11, 0.3)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#E8E0D0', lineHeight: 1.4 }}>
                    {t.text}
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#8B8680', marginTop: '6px' }}>
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
