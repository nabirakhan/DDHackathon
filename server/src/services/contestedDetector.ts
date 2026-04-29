// server/src/services/contestedDetector.ts
import { db } from '../db/supabase.js'
import { broadcastToRoom } from '../ws/hub.js'

interface EditEntry { userId: string; timestamp: number; text: string }

// Track last broadcast per node to prevent spam
const lastBroadcast = new Map<string, number>()
const DEBOUNCE_MS = 10000 // 10 seconds debounce

export async function recordEdit(
  roomId: string,
  nodeId: string,
  userId: string,
  text: string,
  editWindows: Map<string, EditEntry[]>
) {
  // Ignore empty or very short text
  if (!text || text.length < 3) return

  const now = Date.now()
  const window = editWindows.get(nodeId) ?? []
  
  // Add current edit
  window.push({ userId, timestamp: now, text })
  
  // Keep last 60 seconds of edits (increased from 30s)
  const sixtySecondsAgo = now - 60000
  const trimmed = window.filter(e => e.timestamp > sixtySecondsAgo)
  editWindows.set(nodeId, trimmed)

  // Count edits per user
  const editsByUser = new Map<string, { count: number; lastText: string }>()
  for (const edit of trimmed) {
    const existing = editsByUser.get(edit.userId)
    if (existing) {
      existing.count++
      existing.lastText = edit.text
    } else {
      editsByUser.set(edit.userId, { count: 1, lastText: edit.text })
    }
  }
  
  const distinctUsers = Array.from(editsByUser.keys())
  const userEditSummary = Array.from(editsByUser.entries())
    .map(([uid, data]) => `${uid.slice(0,6)}:${data.count}`)
    .join(', ')
  
  console.log(`[contest] node=${nodeId.slice(-6)} users=${distinctUsers.length} (${userEditSummary}) edits=${trimmed.length}`)
  
  // REQUIREMENTS FOR CONTEST:
  // 1. At least 2 different users
  if (distinctUsers.length < 2) {
    console.log(`[contest] Only 1 user - no contest`)
    return
  }
  
  // 2. Each user must have at least 2 edits (shows back-and-forth)
  const hasMultipleEditsPerUser = Array.from(editsByUser.values()).every(data => data.count >= 2)
  if (!hasMultipleEditsPerUser) {
    console.log(`[contest] Not enough edits per user - need each user to edit at least twice`)
    return
  }
  
  // 3. Get the LATEST version from each user (what they're currently trying to say)
  const latestVersions: Record<string, string> = {}
  for (const edit of [...trimmed].reverse()) {
    if (!latestVersions[edit.userId]) {
      latestVersions[edit.userId] = edit.text
    }
  }
  
  // 4. Check if versions are actually different
  const texts = Object.values(latestVersions)
  const allSame = texts.every(t => t === texts[0])
  if (allSame) {
    console.log(`[contest] All users have same text - no contest`)
    return
  }
  
  // 5. Check debounce - don't broadcast if we just broadcasted for this node
  const lastTime = lastBroadcast.get(`${roomId}:${nodeId}`)
  if (lastTime && (now - lastTime) < DEBOUNCE_MS) {
    console.log(`[contest] Debounced - last broadcast was ${now - lastTime}ms ago`)
    return
  }
  
  // Check if there's already an active unresolved contest
  const { data: existing } = await db.from('contested_nodes')
    .select('id')
    .eq('room_id', roomId)
    .eq('node_id', nodeId)
    .is('resolved_at', null)
    .maybeSingle()

  if (existing) {
    console.log(`[contest] Already contested - waiting for resolution`)
    return
  }

  console.log(`[contest] 🎯 CONFLICT DETECTED!`, latestVersions)
  console.log(`[contest] Users: ${distinctUsers.join(', ')}`)
  console.log(`[contest] Versions:`, JSON.stringify(latestVersions, null, 2))

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
    
    // Record broadcast time for debounce
    lastBroadcast.set(`${roomId}:${nodeId}`, now)
    
    broadcastToRoom(roomId, {
      type: 'node:contested',
      payload: { nodeId, versions: latestVersions }
    })
    
    console.log(`[contest] ✅ Broadcasted to room ${roomId}`)
  } catch (err) {
    console.error('[contest] Detection error:', err)
  }
}

// Clean up old debounce entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamp] of lastBroadcast.entries()) {
    if (now - timestamp > 60000) { // Remove after 1 minute
      lastBroadcast.delete(key)
    }
  }
}, 60000)