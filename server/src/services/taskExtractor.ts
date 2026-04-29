import { db } from '../db/supabase.js'
import { classify } from './aiClassifier.js'
import { getRoom } from '../ws/yjsHandler.js'
import { broadcastToRoom } from '../ws/hub.js'

interface TLShapeLocal {
  id: string
  props?: Record<string, unknown>
  [key: string]: unknown
}

function extractShapeText(shape: TLShapeLocal | undefined): string | undefined {
  const props = shape?.props
  if (!props) return undefined
  if (typeof props.text === 'string' && props.text.trim()) return props.text.trim()
  return undefined
}

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
const lastProcessed = new Map<string, { text: string; timestamp: number }>()

export function schedule(roomId: string, nodeId: string, userId: string) {
  const key = `${roomId}:${nodeId}`
  if (pendingTimers.has(key)) clearTimeout(pendingTimers.get(key)!)

  pendingTimers.set(key, setTimeout(async () => {
    pendingTimers.delete(key)
    try {
      const room = getRoom(roomId)
      if (!room) return

      const text = extractShapeText(room.doc.getMap<TLShapeLocal>('shapes').get(nodeId) as TLShapeLocal | undefined)
      if (!text || text.length < 3) return

      const last = lastProcessed.get(key)
      if (last && last.text === text && Date.now() - last.timestamp < 15000) return

      lastProcessed.set(key, { text, timestamp: Date.now() })

      // Classify with AI (falls back to heuristic)
      const intent = await classify(userId, text)

      // Upsert into classified_nodes (one row per node, updated as text changes)
      const { data: existingNode } = await db.from('classified_nodes')
        .select('id')
        .eq('room_id', roomId)
        .eq('node_id', nodeId)
        .maybeSingle()

      if (existingNode) {
        await db.from('classified_nodes')
          .update({ text, intent, updated_at: new Date().toISOString() })
          .eq('id', existingNode.id)
      } else {
        await db.from('classified_nodes').insert({
          room_id: roomId, node_id: nodeId, text, intent, author_id: userId,
        })
      }

      // Upsert into tasks (all intents tracked, not just action_item)
      const { data: existingTask } = await db.from('tasks')
        .select('id, text, intent')
        .eq('source_node_id', nodeId)
        .eq('room_id', roomId)
        .eq('status', 'open')
        .maybeSingle()

      if (existingTask) {
        if (existingTask.text !== text || existingTask.intent !== intent) {
          await db.from('tasks').update({ text, intent }).eq('id', existingTask.id)
          broadcastToRoom(roomId, {
            type: 'task:updated',
            payload: { taskId: existingTask.id, status: 'open', text, intent },
          })
        }
      } else {
        const { data: task, error } = await db.from('tasks').insert({
          room_id: roomId, source_node_id: nodeId, text, intent, author_id: userId, status: 'open',
        }).select().single()

        if (error) { console.error('[task] Insert failed:', error); return }
        broadcastToRoom(roomId, { type: 'task:created', payload: { task } })
      }
    } catch (err) {
      console.error('[task] Error:', err)
    }
  }, 4000))
}
