import * as Y from 'yjs'
import type { AuthSocket } from './types.js'
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
const roomInitLocks = new Map<string, Promise<RoomState>>()
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>()

function encodeSnapshotForDB(snapshot: Uint8Array): string {
  return '\\x' + Buffer.from(snapshot).toString('hex')
}

export function decodeSV(sv: Uint8Array): Record<number, number> {
  const result: Record<number, number> = {}
  let pos = 0
  const readVarUint = (): number => {
    let num = 0, shift = 0
    while (pos < sv.length) {
      const byte = sv[pos++]
      num |= (byte & 0x7f) << shift
      if ((byte & 0x80) === 0) break
      shift += 7
    }
    return num
  }
  const count = readVarUint()
  for (let i = 0; i < count; i++) {
    const client = readVarUint()
    const clock = readVarUint()
    result[client] = clock
  }
  return result
}

function decodeSnapshotFromDB(raw: unknown): Uint8Array {
  if (typeof raw === 'string') {
    const stripped = raw.startsWith('\\x') ? raw.slice(2) : raw
    return Buffer.from(stripped, 'hex')
  }
  return Buffer.from(raw as never)
}

function scheduleSnapshot(roomId: string, doc: Y.Doc) {
  clearTimeout(persistTimers.get(roomId))
  persistTimers.set(roomId, setTimeout(async () => {
    const snapshot = Y.encodeStateAsUpdate(doc)
    const { error } = await db.from('yjs_snapshots').upsert({
      room_id: roomId,
      snapshot: encodeSnapshotForDB(snapshot),
      updated_at: new Date().toISOString()
    })
    if (error) {
      console.error('[snapshot:write] upsert FAILED for room', roomId, ':', error)
    }
  }, 10000))
}

async function initRoom(roomId: string): Promise<RoomState> {
  const doc = new Y.Doc()
  doc.getMap('shapes')

  const { data: snap } = await db
    .from('yjs_snapshots')
    .select('snapshot')
    .eq('room_id', roomId)
    .single()

  if (snap?.snapshot) {
    try {
      const bytes = decodeSnapshotFromDB(snap.snapshot)
      if (bytes.length >= 2) {
        Y.applyUpdate(doc, bytes)
      }
    } catch (applyErr) {
      // Start with empty doc
    }
  }

  const since = new Date(Date.now() - 60000).toISOString()
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
      text: (ev.payload as Record<string, unknown>)?.finalText as string ?? ''
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

export async function getOrCreateRoom(roomId: string): Promise<RoomState> {
  if (rooms.has(roomId)) {
    return rooms.get(roomId)!
  }

  const existing = roomInitLocks.get(roomId)
  if (existing) {
    return existing
  }

  const promise = initRoom(roomId).finally(() => roomInitLocks.delete(roomId))
  roomInitLocks.set(roomId, promise)
  return promise
}

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId)
}

setInterval(async () => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.clients.size === 0 && Date.now() - room.lastActivityAt > 5 * 60000) {
      const snapshot = Y.encodeStateAsUpdate(room.doc)
      await db.from('yjs_snapshots').upsert({
        room_id: roomId, snapshot: encodeSnapshotForDB(snapshot), updated_at: new Date().toISOString()
      })
      clearTimeout(persistTimers.get(roomId))
      persistTimers.delete(roomId)
      rooms.delete(roomId)
    }
  }
}, 60000)

process.on('SIGTERM', async () => {
  for (const t of persistTimers.values()) clearTimeout(t)
  persistTimers.clear()
  for (const [roomId, { doc }] of rooms.entries()) {
    const snapshot = Y.encodeStateAsUpdate(doc)
    await db.from('yjs_snapshots').upsert({
      room_id: roomId, snapshot: encodeSnapshotForDB(snapshot), updated_at: new Date().toISOString()
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
    try { fromSocket.send(JSON.stringify({ type: 'error:malformed_update', payload: {} })) } catch {}
    return
  }

  room.lastActivityAt = Date.now()

  if (textSnapshot) {
    const eventResult = await writeEvent(roomId, fromSocket.userId, 'node:updated', nodeId, { textSnapshot })
    if (eventResult && eventResult.id) {
      scheduleTask(roomId, nodeId, fromSocket.userId)
      recordEdit(roomId, nodeId, fromSocket.userId, textSnapshot, room.editWindows)
    }
  }

  scheduleSnapshot(roomId, room.doc)
  
  broadcastToRoom(roomId, {
    type: 'mutation:broadcast',
    payload: { yjsUpdate: Array.from(yjsUpdate), nodeId }
  }, fromSocket)
}