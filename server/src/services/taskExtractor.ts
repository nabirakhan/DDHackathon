import { db } from '../db/supabase.js'
import { classify } from './aiClassifier.js'
import { getRoom } from '../ws/yjsHandler.js'
import { broadcastToRoom } from '../ws/hub.js'

interface TLShapeLocal {
  id: string
  props?: Record<string, unknown>
  [key: string]: unknown
}

interface DebounceEntry { timer: ReturnType<typeof setTimeout> }
const debounces = new Map<string, DebounceEntry>()

export function schedule(roomId: string, nodeId: string, userId: string) {
  const key = `${roomId}:${nodeId}`
  const existing = debounces.get(key)
  if (existing) clearTimeout(existing.timer)

  const timer = setTimeout(async () => {
    try {
      const room = getRoom(roomId)
      const yShapes = room?.doc.getMap<TLShapeLocal>('shapes')
      const shape = yShapes?.get(nodeId) as TLShapeLocal | undefined
      const text = (shape?.props?.text as string | undefined)?.trim()
      if (!text || text.length < 5) return

      const { data: latestEvent } = await db.from('events')
        .select('id')
        .eq('room_id', roomId)
        .eq('node_id', nodeId)
        .order('id', { ascending: false })
        .limit(1)
        .single()

      const type = await classify(userId, text)
      if (type !== 'action_item') return

      const { data: task, error } = await db.from('tasks').insert({
        room_id: roomId,
        source_event_id: latestEvent?.id ?? null,
        source_node_id: nodeId,
        text,
        author_id: userId,
      }).select().single()
      if (error || !task) { console.error('Task insert failed', error); return }

      broadcastToRoom(roomId, { type: 'task:created', payload: { task } })
    } finally {
      debounces.delete(key)
    }
  }, 1500)

  debounces.set(key, { timer })
}
