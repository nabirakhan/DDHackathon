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

function isActionItem(text: string): boolean {
  const lower = text.toLowerCase()
  
  const actionKeywords = ['todo', 'to do', 'task:', 'action:', 'need to', 'must', 'should',
    'responsible', 'assign', 'deadline', 'fix', 'implement', 'create', 'build', 'make']
  
  for (const keyword of actionKeywords) {
    if (lower.includes(keyword)) {
      return true
    }
  }
  
  return false
}

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
const lastProcessedText = new Map<string, { text: string; timestamp: number }>()

export function schedule(roomId: string, nodeId: string, userId: string) {
  const key = `${roomId}:${nodeId}`
  
  if (pendingTimers.has(key)) {
    clearTimeout(pendingTimers.get(key)!)
  }
  
  const timer = setTimeout(async () => {
    try {
      const room = getRoom(roomId)
      if (!room) {
        pendingTimers.delete(key)
        return
      }
      
      const yShapes = room.doc.getMap<TLShapeLocal>('shapes')
      const shape = yShapes.get(nodeId) as TLShapeLocal | undefined
      const text = extractShapeText(shape)

      if (!text || text.length < 3) {
        pendingTimers.delete(key)
        return
      }

      const last = lastProcessedText.get(nodeId)
      if (last && last.text === text && Date.now() - last.timestamp < 10000) {
        pendingTimers.delete(key)
        return
      }
      
      const isAction = isActionItem(text)
      
      if (!isAction) {
        lastProcessedText.set(nodeId, { text, timestamp: Date.now() })
        pendingTimers.delete(key)
        return
      }

      const { data: existingTask } = await db.from('tasks')
        .select('id, text')
        .eq('source_node_id', nodeId)
        .eq('room_id', roomId)
        .eq('status', 'open')
        .maybeSingle()

      if (existingTask) {
        if (existingTask.text !== text) {
          await db.from('tasks').update({ text }).eq('id', existingTask.id)
          broadcastToRoom(roomId, { 
            type: 'task:updated', 
            payload: { taskId: existingTask.id, status: 'open' } 
          })
        }
      } else {
        const { data: task, error } = await db.from('tasks').insert({
          room_id: roomId,
          source_node_id: nodeId,
          text: text,
          author_id: userId,
          status: 'open'
        }).select().single()

        if (error) {
          console.error('[task] Insert failed:', error)
          pendingTimers.delete(key)
          return
        }

        broadcastToRoom(roomId, { type: 'task:created', payload: { task } })
      }
      
      lastProcessedText.set(nodeId, { text, timestamp: Date.now() })
      
    } catch (err) {
      console.error('[task] Error:', err)
    } finally {
      pendingTimers.delete(key)
    }
  }, 3000)

  pendingTimers.set(key, timer)
}