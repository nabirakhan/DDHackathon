import { db } from '../db/supabase.js'
import { classify } from './aiClassifier.js'
import { getRoom } from '../ws/yjsHandler.js'
import { broadcastToRoom } from '../ws/hub.js'

interface TLShapeLocal {
  id: string
  props?: Record<string, unknown>
  [key: string]: unknown
}

// Extract plain text from a TipTap/ProseMirror JSON node (tldraw v3 richText format).
function extractRichText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; text?: string; content?: unknown[] }
  if (n.type === 'text') return n.text ?? ''
  return (n.content ?? []).map(extractRichText).join('')
}

function extractShapeText(shape: TLShapeLocal | undefined): string | undefined {
  const props = shape?.props
  if (!props) return undefined
  if (typeof props.text === 'string' && props.text.trim()) return props.text.trim()
  if (props.richText) return extractRichText(props.richText).trim() || undefined
  return undefined
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
      const text = extractShapeText(shape)

      console.log(`[task:trigger] nodeId=${nodeId} text="${text?.slice(0, 80) ?? '(empty)'}" shapeExists=${!!shape}`)

      if (!text || text.length < 5) {
        console.log(`[task:trigger] skipping — text too short or empty`)
        return
      }

      const { data: latestEvent } = await db.from('events')
        .select('id')
        .eq('room_id', roomId)
        .eq('node_id', nodeId)
        .order('id', { ascending: false })
        .limit(1)
        .single()

      console.log(`[task:classify] starting for nodeId=${nodeId} text="${text.slice(0, 60)}"`)
      const type = await classify(userId, text)
      console.log(`[task:result] nodeId=${nodeId} classification="${type}"`)

      if (type !== 'action_item') {
        console.log(`[task:result] not an action_item — skipping insert`)
        return
      }

      console.log(`[task:db_write] inserting task for nodeId=${nodeId}`)
      const { data: task, error } = await db.from('tasks').insert({
        room_id: roomId,
        source_event_id: latestEvent?.id ?? null,
        source_node_id: nodeId,
        text,
        author_id: userId,
      }).select().single()

      if (error || !task) {
        console.error('[task:db_write] insert FAILED:', error)
        return
      }

      console.log(`[task:db_write] task created id=${task.id}`)
      broadcastToRoom(roomId, { type: 'task:created', payload: { task } })
    } finally {
      debounces.delete(key)
    }
  }, 1500)

  debounces.set(key, { timer })
}
