import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle } from 'lucide-react'
import { wsClient } from '../lib/wsClient'
import { useEditor } from '../context/CanvasContext'
import { supabase } from '../lib/supabase'
import type { TLShapeId } from 'tldraw'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

interface Task {
  id: string
  source_node_id: string
  text: string
  author_id: string
  created_at: string
  room_id: string
  status: 'open' | 'done'
  intent?: string
}

const intentMeta: Record<string, { label: string; color: string; bg: string }> = {
  action_item:   { label: 'Action',    color: '#84A98C', bg: 'rgba(132,169,140,0.15)' },
  decision:      { label: 'Decision',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  open_question: { label: 'Question',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  reference:     { label: 'Reference', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
}

const intentBorderColor: Record<string, string> = {
  action_item:   'rgba(132,169,140,0.5)',
  decision:      'rgba(251,191,36,0.5)',
  open_question: 'rgba(96,165,250,0.5)',
  reference:     'rgba(167,139,250,0.5)',
}

export function TaskBoard({ roomId }: { roomId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const editor = useEditor()

  // Fetch existing tasks on mount
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) return
      fetch(`${SERVER_URL}/rooms/${roomId}/tasks`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(json => { if (!cancelled) setTasks(json.tasks ?? []) })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [roomId])

  // Realtime updates
  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'task:created' && msg.payload.task.room_id === roomId) {
        setTasks(t => {
          if (t.some(x => x.id === msg.payload.task.id)) return t
          return [...t, { ...msg.payload.task, status: (msg.payload.task.status ?? 'open') as 'open' | 'done' }]
        })
      }
      if (msg.type === 'task:updated') {
        setTasks(t => t.map(task =>
          task.id === msg.payload.taskId
            ? { ...task, status: msg.payload.status as 'open' | 'done', ...(msg.payload.text ? { text: msg.payload.text } : {}), ...(msg.payload.intent ? { intent: msg.payload.intent } : {}) }
            : task
        ))
      }
    })
  }, [roomId])

  const markDone = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`${SERVER_URL}/rooms/${roomId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ status: 'done' }),
    })
  }

  const openTasks = tasks.filter(t => t.status === 'open')
  const doneTasks = tasks.filter(t => t.status === 'done')

  return (
    <div style={{
      width: '264px', flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'rgba(47, 62, 70, 0.65)',
      backdropFilter: 'blur(40px) saturate(150%)',
      WebkitBackdropFilter: 'blur(40px) saturate(150%)',
      border: '1px solid rgba(202, 210, 197, 0.08)',
      borderRadius: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', overflow: 'hidden',
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
        {openTasks.length > 0 && (
          <span style={{ padding: '1px 6px', borderRadius: '999px', background: 'rgba(132,169,140,0.15)', border: '1px solid rgba(132,169,140,0.25)', fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 600, color: '#84A98C' }}>
            {openTasks.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: 'rgba(202,210,197,0.3)', fontSize: '9px' }}>{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '12px' }}>
          {openTasks.length === 0 && doneTasks.length === 0 ? (
            <div style={{ padding: '24px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(202,210,197,0.3)', lineHeight: 1.6 }}>
                No items yet.
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(202,210,197,0.18)', marginTop: '4px' }}>
                Write anything on the canvas
              </div>
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {openTasks.map((t, i) => {
                  const meta = intentMeta[t.intent ?? 'action_item'] ?? intentMeta.action_item
                  const borderColor = intentBorderColor[t.intent ?? 'action_item'] ?? intentBorderColor.action_item
                  const isAction = !t.intent || t.intent === 'action_item'
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0, padding: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => { const s = editor?.getShape(t.source_node_id as TLShapeId); if (s) { editor?.select(t.source_node_id as TLShapeId); editor?.zoomToSelection() } }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%',
                        padding: '12px 14px', marginBottom: '8px',
                        background: 'rgba(53, 79, 82, 0.5)',
                        border: '1px solid rgba(202,210,197,0.07)',
                        borderLeft: `3px solid ${borderColor}`,
                        borderRadius: '1.25rem', textAlign: 'left', cursor: 'pointer',
                      }}
                    >
                      {isAction ? (
                        <button
                          onClick={(e) => markDone(e, t.id)}
                          title="Mark done"
                          style={{ flexShrink: 0, marginTop: '2px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(132,169,140,0.5)', transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#84A98C')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(132,169,140,0.5)')}
                        >
                          <Circle size={14} />
                        </button>
                      ) : (
                        <span style={{ flexShrink: 0, marginTop: '3px', width: '8px', height: '8px', borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{
                            fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 700,
                            color: meta.color, background: meta.bg,
                            padding: '1px 6px', borderRadius: '999px', letterSpacing: '0.5px', textTransform: 'uppercase',
                          }}>
                            {meta.label}
                          </span>
                        </div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500, color: '#CAD2C5', lineHeight: 1.5 }}>
                          {t.text}
                        </div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '9px', color: 'rgba(202,210,197,0.3)', marginTop: '4px' }}>
                          {new Date(t.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {doneTasks.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <button
                    onClick={() => setShowDone(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px', marginBottom: '4px' }}
                  >
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(202,210,197,0.3)', fontWeight: 600 }}>
                      {showDone ? '▲' : '▼'} Completed ({doneTasks.length})
                    </span>
                  </button>
                  <AnimatePresence>
                    {showDone && doneTasks.map(t => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '8px',
                          padding: '10px 14px', marginBottom: '6px',
                          background: 'rgba(53,79,82,0.2)', border: '1px solid rgba(202,210,197,0.04)',
                          borderLeft: '3px solid rgba(132,169,140,0.2)', borderRadius: '1.25rem', opacity: 0.6,
                        }}
                      >
                        <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#84A98C' }} />
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(202,210,197,0.5)', textDecoration: 'line-through', lineHeight: 1.4 }}>
                          {t.text}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
