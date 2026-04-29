import { db } from '../db/supabase.js'
import { broadcastToRoom } from '../ws/hub.js'

interface EditEntry { userId: string; timestamp: number; text: string }

// Per-node quiet-period timers — reset on every edit, fires 60s after last edit
const nodeTimers = new Map<string, ReturnType<typeof setTimeout>>()

export async function recordEdit(
  roomId: string,
  nodeId: string,
  userId: string,
  text: string,
  editWindows: Map<string, EditEntry[]>
) {
  if (!text || text.trim().length < 3) return

  const now = Date.now()
  const window = editWindows.get(nodeId) ?? []
  window.push({ userId, timestamp: now, text: text.trim() })
  // Keep 3 minutes of history so the 60s timer can look back far enough
  editWindows.set(nodeId, window.filter(e => e.timestamp > now - 180000))

  // Reset quiet-period timer — wait 60s of silence before evaluating
  const key = `${roomId}:${nodeId}`
  const existing = nodeTimers.get(key)
  if (existing) clearTimeout(existing)

  nodeTimers.set(key, setTimeout(() => {
    nodeTimers.delete(key)
    void checkContest(roomId, nodeId, editWindows)
  }, 60000))
}

async function checkContest(roomId: string, nodeId: string, editWindows: Map<string, EditEntry[]>) {
  // Only consider edits in the last 90s — prevents stale anonymous-session data
  // from a previous browser session being treated as a second "user"
  const cutoff = Date.now() - 90000
  const edits = (editWindows.get(nodeId) ?? []).filter(e => e.timestamp > cutoff)
  if (edits.length === 0) return

  // Build per-user edit count + latest text
  const byUser = new Map<string, { count: number; lastText: string }>()
  for (const edit of edits) {
    const u = byUser.get(edit.userId)
    if (u) { u.count++; u.lastText = edit.text }
    else byUser.set(edit.userId, { count: 1, lastText: edit.text })
  }

  // Require 2+ distinct users, each with 3+ edits (raises bar against stale anonymous sessions)
  if (byUser.size < 2) return
  if ([...byUser.values()].some(u => u.count < 3)) return

  // Latest texts must actually differ
  const texts = [...byUser.values()].map(u => u.lastText)
  if (texts.every(t => t === texts[0])) return

  // Reject if one text is a prefix of another — same person mid-typing across sessions
  const sorted = [...texts].sort((a, b) => a.length - b.length)
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1].toLowerCase().startsWith(sorted[i].toLowerCase())) return
  }

  // Don't re-open if already an active contest
  const { data: existing } = await db.from('contested_nodes')
    .select('detected_at')
    .eq('room_id', roomId)
    .eq('node_id', nodeId)
    .is('resolved_at', null)
    .maybeSingle()
  if (existing) return

  const versions: Record<string, string> = {}
  for (const [uid, u] of byUser) versions[uid] = u.lastText

  console.log(`[contest] 🎯 CONFLICT node=${nodeId.slice(-6)}`, versions)

  const { error } = await db.from('contested_nodes').insert({
    room_id: roomId,
    node_id: nodeId,
    versions,
  })
  if (error) { console.error('[contest] Insert failed:', error); return }

  broadcastToRoom(roomId, { type: 'node:contested', payload: { nodeId, versions } })
  console.log(`[contest] ✅ Broadcasted`)
}
