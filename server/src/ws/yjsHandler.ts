import * as Y from 'yjs'
import type { AuthSocket } from '@shared/types'
import { db } from '../db/supabase.js'
import { writeEvent } from '../services/eventLog.js'
import { schedule as scheduleTask } from '../services/taskExtractor.js'
import { recordEdit } from '../services/contestedDetector.js'
import { broadcastToRoom } from './hub.js'

interface EditEntry { userId: string; timestamp: number; text: string }

export interface RoomState {
  doc: Y.Doc
  clients: Set<AuthSocket>
  editWindows: Map<string, EditEntry[]>
  sessionStartedAt: string | null
  lastActivityAt: number
}

export const rooms = new Map<string, RoomState>()
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleSnapshot(roomId: string, doc: Y.Doc) {
  clearTimeout(persistTimers.get(roomId))
  persistTimers.set(roomId, setTimeout(async () => {
    const snapshot = Y.encodeStateAsUpdate(doc)
    await db.from('yjs_snapshots').upsert({
      room_id: roomId,
      snapshot: Buffer.from(snapshot),
      updated_at: new Date().toISOString()
    })
  }, 5000))
}

export async function getOrCreateRoom(roomId: string): Promise<RoomState> {
  if (rooms.has(roomId)) return rooms.get(roomId)!
  const doc = new Y.Doc()
  const { data: snap } = await db.from('yjs_snapshots').select('snapshot').eq('room_id', roomId).single()
  if (snap?.snapshot) {
    Y.applyUpdate(doc, new Uint8Array(snap.snapshot as unknown as ArrayBuffer))
  }

  const since = new Date(Date.now() - 60_000).toISOString()
  const { data: recentEvents } = await db.from('events')
    .select('user_id, node_id, payload, timestamp')
    .eq('room_id', roomId).eq('event_type', 'node:updated').gte('timestamp', since)
  const editWindows = new Map<string, EditEntry[]>()
  for (const ev of recentEvents ?? []) {
    if (!ev.node_id) continue
    const w = editWindows.get(ev.node_id) ?? []
    w.push({
      userId: ev.user_id,
      timestamp: new Date(ev.timestamp as string).getTime(),
      text: (ev.payload as Record<string, unknown>)?.textSnapshot as string ?? ''
    })
    editWindows.set(ev.node_id, w)
  }

  const { data: roomRow } = await db.from('rooms').select('session_started_at').eq('id', roomId).single()

  const state: RoomState = {
    doc,
    clients: new Set(),
    editWindows,
    sessionStartedAt: roomRow?.session_started_at ?? null,
    lastActivityAt: Date.now()
  }
  rooms.set(roomId, state)
  return state
}

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId)
}

setInterval(async () => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.clients.size === 0 && Date.now() - room.lastActivityAt > 5 * 60_000) {
      const snapshot = Y.encodeStateAsUpdate(room.doc)
      await db.from('yjs_snapshots').upsert({
        room_id: roomId, snapshot: Buffer.from(snapshot), updated_at: new Date().toISOString()
      })
      clearTimeout(persistTimers.get(roomId))
      persistTimers.delete(roomId)
      rooms.delete(roomId)
    }
  }
}, 60_000)

process.on('SIGTERM', async () => {
  for (const t of persistTimers.values()) clearTimeout(t)
  persistTimers.clear()
  for (const [roomId, { doc }] of rooms.entries()) {
    const snapshot = Y.encodeStateAsUpdate(doc)
    await db.from('yjs_snapshots').upsert({
      room_id: roomId, snapshot: Buffer.from(snapshot), updated_at: new Date().toISOString()
    })
  }
  process.exit(0)
})

export async function applyMutation(
  roomId: string,
  fromSocket: AuthSocket,
  yjsUpdate: Uint8Array,
  nodeId: string,
  textSnapshot?: string
) {
  const room = await getOrCreateRoom(roomId)

  try {
    Y.applyUpdate(room.doc, yjsUpdate)
  } catch (err) {
    fromSocket.send(JSON.stringify({ type: 'error:malformed_update', payload: {} }))
    console.error('Yjs apply failed', err)
    return
  }

  room.lastActivityAt = Date.now()

  const { data: event } = await writeEvent(roomId, fromSocket.userId, 'node:updated', nodeId, { textSnapshot })

  if (event && textSnapshot) {
    scheduleTask(roomId, nodeId, fromSocket.userId)
    recordEdit(roomId, nodeId, fromSocket.userId, textSnapshot, room.editWindows)
  }

  scheduleSnapshot(roomId, room.doc)
  broadcastToRoom(roomId, {
    type: 'mutation:broadcast',
    payload: { yjsUpdate: Array.from(yjsUpdate), nodeId }
  }, fromSocket)
}
