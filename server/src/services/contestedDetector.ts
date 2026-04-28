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
  if (!text || text.length < 3) return

  const window = editWindows.get(nodeId) ?? []
  window.push({ userId, timestamp: Date.now(), text })
  
  const thirtySecondsAgo = Date.now() - 30000
  const trimmed = window.filter(e => e.timestamp > thirtySecondsAgo)
  editWindows.set(nodeId, trimmed)

  const distinctUsers = [...new Set(trimmed.map(e => e.userId))]
  
  console.log(`[contest] node=${nodeId.slice(-6)} users=${distinctUsers.length} edits=${trimmed.length}`)
  
  if (distinctUsers.length < 2) return

  const latestVersions: Record<string, string> = {}
  for (const edit of [...trimmed].reverse()) {
    if (!latestVersions[edit.userId]) {
      latestVersions[edit.userId] = edit.text
    }
  }

  const texts = Object.values(latestVersions)
  if (texts.length === 2 && texts[0] === texts[1]) {
    console.log(`[contest] Same text, no contest`)
    return
  }

  const { data: existing } = await db.from('contested_nodes')
    .select('id')
    .eq('room_id', roomId)
    .eq('node_id', nodeId)
    .is('resolved_at', null)
    .maybeSingle()

  if (existing) return

  console.log(`[contest] 🎯 CONFLICT:`, latestVersions)

  try {
    const { error } = await db.from('contested_nodes').insert({
      room_id: roomId,
      node_id: nodeId,
      versions: latestVersions,
      created_at: new Date().toISOString()
    })
    
    if (error) {
      console.error('Contest insert failed', error)
      return
    }
    
    broadcastToRoom(roomId, {
      type: 'node:contested',
      payload: { nodeId, versions: latestVersions }
    })
    
    console.log(`[contest] ✅ Broadcasted`)
  } catch (err) {
    console.error('Contest detection error', err)
  }
}