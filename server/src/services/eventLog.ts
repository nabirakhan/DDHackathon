import { db } from '../db/supabase.js'

export async function writeEvent(
  roomId: string,
  userId: string,
  eventType: string,
  nodeId: string | null,
  payload: Record<string, unknown>
) {
  return await db
    .from('events')
    .insert({ room_id: roomId, user_id: userId, event_type: eventType, node_id: nodeId, payload })
    .select('id')
    .single()
}
