import { db } from '../db/supabase.js'
import { classify } from './aiClassifier.js'
import { getRoom } from '../ws/yjsHandler.js'
import { broadcastToRoom } from '../ws/hub.js'

// Handle both plain objects and Y.Map instances (tldraw stores shapes as plain objects,
// but guard against Y.Map just in case)
function getProp(obj: unknown, key: string): unknown {
  if (!obj) return undefined
  if (typeof (obj as any).get === 'function') return (obj as any).get(key)
  return (obj as any)[key]
}

function extractShapeText(shape: unknown): string | undefined {
  if (!shape) return undefined
  const props = getProp(shape, 'props')
  if (!props) return undefined
  const text = getProp(props, 'text')
  if (typeof text === 'string' && text.trim().length > 0) return text.trim()
  // richText fallback (tldraw note shapes)
  const richText = getProp(props, 'richText') as any
  if (richText) {
    const flat = JSON.stringify(richText).replace(/"text":"([^"]*)"/g, '$1').replace(/[^a-zA-Z0-9 .,!?']/g, ' ').trim()
    if (flat.length > 0) return flat
  }
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
      if (!room) {
        console.warn(`[task] room ${roomId} not found, skipping`)
        return
      }

      const rawShape = room.doc.getMap('shapes').get(nodeId)
      const text = extractShapeText(rawShape)
      console.log(`[task] node=${nodeId.slice(-6)} text="${text?.slice(0, 40) ?? 'none'}"`)
      if (!text || text.length < 3) return

      const last = lastProcessed.get(key)
      if (last && last.text === text && Date.now() - last.timestamp < 15000) return
      lastProcessed.set(key, { text, timestamp: Date.now() })

      const intent = await classify(userId, text)
      console.log(`[task] classified as ${intent}`)

      // Insert into classified_nodes (allow multiple rows per node — no unique constraint)
      await db.from('classified_nodes').insert({
        room_id: roomId, node_id: nodeId, text, intent, author_id: userId,
      }).then(({ error }) => {
        if (error) console.error('[task] classified_nodes insert error:', error.message)
      })

      // Upsert task — use limit(1) instead of maybeSingle to avoid multi-row error
      const { data: existing } = await db.from('tasks')
        .select('id, text, intent')
        .eq('source_node_id', nodeId)
        .eq('room_id', roomId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)

      const existingTask = existing?.[0] ?? null

      if (existingTask) {
        if (existingTask.text !== text || existingTask.intent !== intent) {
          await db.from('tasks').update({ text, intent }).eq('id', existingTask.id)
          broadcastToRoom(roomId, {
            type: 'task:updated',
            payload: { taskId: existingTask.id, status: 'open', text, intent },
          })
          console.log(`[task] updated task ${existingTask.id}`)
        }
      } else {
        const { data: task, error } = await db.from('tasks').insert({
          room_id: roomId, source_node_id: nodeId, text, intent, author_id: userId, status: 'open',
        }).select().single()

        if (error) { console.error('[task] tasks insert error:', error.message); return }
        broadcastToRoom(roomId, { type: 'task:created', payload: { task } })
        console.log(`[task] created task ${task?.id} intent=${intent}`)
      }
    } catch (err) {
      console.error('[task] unhandled error:', err)
    }
  }, 3000))
}
