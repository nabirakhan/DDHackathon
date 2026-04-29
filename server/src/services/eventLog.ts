import { db } from '../db/supabase.js'

const eventDebounceMap = new Map<string, NodeJS.Timeout>()
const pendingEvents = new Map<string, {
  roomId: string
  userId: string
  eventType: string
  nodeId: string | null
  payload: Record<string, unknown>
  count: number
  firstText: string | null
}>()

export async function writeEvent(
  roomId: string,
  userId: string,
  eventType: string,
  nodeId: string | null,
  payload: Record<string, unknown>
) {
  const textSnapshot = payload.textSnapshot as string | undefined

  // Skip pure position/resize mutations — only log updates that carry text content
  if (eventType === 'node:updated' && !textSnapshot) return { id: null }

  const key = `${roomId}:${nodeId}:${eventType}`
  
  if (!pendingEvents.has(key)) {
    pendingEvents.set(key, {
      roomId, userId, eventType, nodeId,
      payload: { ...payload },
      count: 1,
      firstText: textSnapshot || null
    })
  } else {
    const existing = pendingEvents.get(key)!
    existing.count++
    existing.payload = { ...existing.payload, ...payload, mutationCount: existing.count }
    existing.userId = userId
    pendingEvents.set(key, existing)
  }
  
  if (eventDebounceMap.has(key)) {
    clearTimeout(eventDebounceMap.get(key)!)
  }
  
  eventDebounceMap.set(key, setTimeout(async () => {
    const event = pendingEvents.get(key)
    if (event) {
      const finalPayload = event.count > 1 
        ? { ...event.payload, batchedCount: event.count, finalText: event.payload.textSnapshot || event.firstText }
        : event.payload
      
      await db.from('events').insert({
        room_id: event.roomId,
        user_id: event.userId,
        event_type: event.eventType,
        node_id: event.nodeId,
        payload: finalPayload,
        timestamp: new Date().toISOString()
      })
      pendingEvents.delete(key)
    }
    eventDebounceMap.delete(key)
  }, 800))
  
  return { id: key }
}