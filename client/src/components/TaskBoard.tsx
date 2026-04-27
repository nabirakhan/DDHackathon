import { useEffect, useState } from 'react'
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
  const editor = useEditor()

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'task:created' && msg.payload.task.room_id === roomId) {
        setTasks(t => [...t, msg.payload.task as Task])
      }
    })
  }, [roomId])

  return (
    <aside className="w-72 border-l p-4 overflow-y-auto bg-white">
      <h3 className="font-semibold mb-3 text-slate-800">Action Items</h3>
      {tasks.length === 0 && (
        <p className="text-sm text-slate-400">No tasks yet. Add text like "we need to..." to a shape.</p>
      )}
      {tasks.map(t => (
        <button
          key={t.id}
          onClick={() => editor?.zoomToShape(t.source_node_id as TLShapeId)}
          className="block w-full text-left p-2 mb-2 border rounded hover:bg-slate-50 transition-colors"
        >
          <div className="text-sm text-slate-800">{t.text}</div>
          <div className="text-xs text-slate-500 mt-1">
            {new Date(t.created_at).toLocaleTimeString()}
          </div>
        </button>
      ))}
    </aside>
  )
}
