import { db } from '../db/supabase.js'
import { classify } from './aiClassifier.js'
import { getRoom } from '../ws/yjsHandler.js'
import { broadcastToRoom } from '../ws/hub.js'

interface TLShapeLocal {
  id: string
  props?: Record<string, unknown>
  [key: string]: unknown
}

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

interface DebounceEntry { timer: ReturnType<typeof setTimeout>; editCount: number }
const debounces = new Map<string, DebounceEntry>()
const lastClassifiedText = new Map<string, string>()

export function schedule(roomId: string, nodeId: string, userId: string) {
  const key = `${roomId}:${nodeId}`
  const existing = debounces.get(key)
  
  if (existing) {
    clearTimeout(existing.timer)
    existing.editCount++
    debounces.set(key, existing)
  } else {
    debounces.set(key, { timer: setTimeout(() => {}, 0), editCount: 1 })
  }

  const timer = setTimeout(async () => {
    try {
      const entry = debounces.get(key)
      const totalEdits = entry?.editCount || 1
      
      const room = getRoom(roomId)
      const yShapes = room?.doc.getMap<TLShapeLocal>('shapes')
      const shape = yShapes?.get(nodeId) as TLShapeLocal | undefined
      const text = extractShapeText(shape)

      if (!text || text.length < 5) {
        return
      }

      if (lastClassifiedText.get(nodeId) === text) {
        return
      }

      const type = await classify(userId, text)
      lastClassifiedText.set(nodeId, text)

      if (type !== 'action_item') {
        return
      }

      const { data: existingTask } = await db.from('tasks')
        .select('id')
        .eq('source_node_id', nodeId)
        .eq('room_id', roomId)
        .eq('status', 'open')
        .maybeSingle()

      if (existingTask) {
        return
      }

      const { data: latestEvent } = await db.from('events')
        .select('id')
        .eq('room_id', roomId)
        .eq('node_id', nodeId)
        .order('id', { ascending: false })
        .limit(1)
        .single()

      const { data: task, error } = await db.from('tasks').insert({
        room_id: roomId,
        source_event_id: latestEvent?.id ?? null,
        source_node_id: nodeId,
        text,
        author_id: userId,
        metadata: { editCount: totalEdits }
      }).select().single()

      if (error || !task) {
        return
      }

      broadcastToRoom(roomId, { type: 'task:created', payload: { task } })
    } finally {
      debounces.delete(key)
    }
  }, 3000)

  debounces.set(key, { timer, editCount: existing?.editCount || 1 })
}