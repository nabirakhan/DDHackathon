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
  // Ignore empty or very short text
  if (!text || text.length < 3) return

  const window = editWindows.get(nodeId) ?? []
  window.push({ userId, timestamp: Date.now(), text })
  
  // Keep last 30 seconds of edits
  const thirtySecondsAgo = Date.now() - 30000
  const trimmed = window.filter(e => e.timestamp > thirtySecondsAgo)
  editWindows.set(nodeId, trimmed)

  // Count edits per user
  const editsByUser = new Map<string, number>()
  for (const edit of trimmed) {
    editsByUser.set(edit.userId, (editsByUser.get(edit.userId) || 0) + 1)
  }
  
  const distinctUsers = [...new Set(trimmed.map(e => e.userId))]
  const userEditCounts = Array.from(editsByUser.entries()).map(([uid, count]) => `${uid.slice(0,6)}:${count}`).join(', ')
  
  console.log(`[contest] node=${nodeId.slice(-6)} users=${distinctUsers.length} (${userEditCounts}) edits=${trimmed.length}`)
  
  // Require: at least 2 users AND at least 3 total edits (minimum for meaningful conflict)
  if (distinctUsers.length < 2 || trimmed.length < 3) {
    console.log(`[contest] Not enough conflict - skipping`)
    return
  }

  // Get the latest version from each user
  const latestVersions: Record<string, string> = {}
  // Also track edit counts to require at least 2 edits from at least one user
  const userEditCount: Record<string, number> = {}
  
  for (const edit of [...trimmed].reverse()) {
    if (!latestVersions[edit.userId]) {
      latestVersions[edit.userId] = edit.text
    }
    userEditCount[edit.userId] = (userEditCount[edit.userId] || 0) + 1
  }

  // Require that at least one user has edited this node multiple times (3+)
  // This ensures it's a real back-and-forth conflict, not just two people writing once
  const hasMultipleEdits = Object.values(userEditCount).some(count => count >= 3)
  if (!hasMultipleEdits && distinctUsers.length === 2) {
    console.log(`[contest] No user edited multiple times - need back-and-forth conflict`)
    return
  }

  // Check if texts are actually different
  const texts = Object.values(latestVersions)
  if (texts.length === 2 && texts[0] === texts[1]) {
    console.log(`[contest] Same text, no contest`)
    return
  }

  // Check if there's already an active contest for this node
  const { data: existing } = await db.from('contested_nodes')
    .select('id')
    .eq('room_id', roomId)
    .eq('node_id', nodeId)
    .is('resolved_at', null)
    .maybeSingle()

  if (existing) {
    console.log(`[contest] Already contested - skipping`)
    return
  }

  console.log(`[contest] 🎯 CONFLICT DETECTED!`, latestVersions)

  try {
    const { error } = await db.from('contested_nodes').insert({
      room_id: roomId,
      node_id: nodeId,
      versions: latestVersions,
      detected_at: new Date().toISOString()
    })
    
    if (error) {
      console.error('[contest] Insert failed:', error)
      return
    }
    
    broadcastToRoom(roomId, {
      type: 'node:contested',
      payload: { nodeId, versions: latestVersions }
    })
    
    console.log(`[contest] ✅ Broadcasted to room ${roomId}`)
  } catch (err) {
    console.error('[contest] Detection error:', err)
  }
}