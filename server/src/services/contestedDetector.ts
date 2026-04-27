import { db } from '../db/supabase.js'
import { broadcastToRoom } from '../ws/hub.js'

interface EditEntry { userId: string; timestamp: number; text: string }

export async function recordEdit(
  roomId: string,
  nodeId: string,
  userId: string,
  text: string,
  editWindows: Map<string, EditEntry[]>
) {
  const window = editWindows.get(nodeId) ?? []
  window.push({ userId, timestamp: Date.now(), text })
  const trimmed = window.filter(e => Date.now() - e.timestamp < 60_000)
  editWindows.set(nodeId, trimmed)

  const distinctUsers = new Set(trimmed.map(e => e.userId))
  if (distinctUsers.size < 2 || trimmed.length < 4) return

  const [u1, u2] = Array.from(distinctUsers).slice(0, 2)
  const v1 = [...trimmed].reverse().find(e => e.userId === u1)!.text
  const v2 = [...trimmed].reverse().find(e => e.userId === u2)!.text

  try {
    const { error } = await db.from('contested_nodes').insert({
      room_id: roomId, node_id: nodeId, versions: { [u1]: v1, [u2]: v2 }
    })
    if ((error as { code?: string } | null)?.code === '23505') return
    if (error) { console.error('Contest insert failed', error); return }
    broadcastToRoom(roomId, {
      type: 'node:contested',
      payload: { nodeId, versions: { [u1]: v1, [u2]: v2 } }
    })
  } catch (err) {
    console.error('Contest detection error', err)
  }
}
