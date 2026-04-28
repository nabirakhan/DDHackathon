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
// Promise-lock: prevents two concurrent getOrCreateRoom calls for the same roomId
// from each initialising a separate Y.Doc and the second overwriting the first.
const roomInitLocks = new Map<string, Promise<RoomState>>()
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>()

function encodeSnapshotForDB(snapshot: Uint8Array): string {
  // PostgREST expects BYTEA as "\\xDEADBEEF" hex-encoded string
  return '\\x' + Buffer.from(snapshot).toString('hex')
}

// Decode the binary state-vector so it prints as { clientID: clock } instead of raw bytes.
// Exported so replayHandler can use it without re-implementing the varint decoder.
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
  // Log enough detail to diagnose any format mismatch without ambiguity
  const typeLabel = typeof raw
  const rawPreview = typeof raw === 'string'
    ? raw.slice(0, 80)                      // direct string preview — no JSON.stringify wrapping
    : JSON.stringify(raw)?.slice(0, 80)     // object/other: stringify so structure is visible
  const rawLen = typeof raw === 'string' ? raw.length : '(non-string)'
  console.log(`[snapshot:decode] type=${typeLabel} stringLen=${rawLen} preview="${rawPreview}"`)

  if (typeof raw === 'string') {
    // PostgREST BYTEA response arrives as "\\xDEADBEEF" — strip the leading \x then hex-decode
    const stripped = raw.startsWith('\\x') ? raw.slice(2) : raw
    const didStrip = stripped !== raw
    console.log(`[snapshot:decode] \\x prefix present=${didStrip} remainingHexChars=${stripped.length}`)

    const bytes = Buffer.from(stripped, 'hex')
    console.log(`[snapshot:decode] hex→bytes: ${stripped.length} hex chars → ${bytes.length} bytes | first8=[${Array.from(bytes.slice(0, 8)).join(',')}]`)

    if (bytes.length === 0 && stripped.length > 0) {
      // Buffer.from with 'hex' silently returns empty when the input is not valid hex.
      // This happens when the snapshot was written in the old broken format
      // (Buffer serialised as {"type":"Buffer","data":[...]}), meaning PostgREST stored
      // the JSON string bytes and is now returning their hex encoding.
      console.error(`[snapshot:decode] ERROR: ${stripped.length} hex chars decoded to 0 bytes — input is not valid hex. Raw value might be an old-format Buffer JSON object encoded as hex.`)
    }
    return bytes
  }

  // Non-string fallback: handles { type: 'Buffer', data: [...] } and ArrayBuffer
  const bytes = Buffer.from(raw as never)
  console.log(`[snapshot:decode] non-string fallback Buffer.from → ${bytes.length} bytes | first8=[${Array.from(bytes.slice(0, 8)).join(',')}]`)
  return bytes
}

function scheduleSnapshot(roomId: string, doc: Y.Doc) {
  clearTimeout(persistTimers.get(roomId))
  persistTimers.set(roomId, setTimeout(async () => {
    const snapshot = Y.encodeStateAsUpdate(doc)
    const sv = decodeSV(Y.encodeStateVector(doc))
    console.log(`[snapshot:write] persisting ${snapshot.length} bytes for room ${roomId} | sv=${JSON.stringify(sv)}`)
    const { error } = await db.from('yjs_snapshots').upsert({
      room_id: roomId,
      snapshot: encodeSnapshotForDB(snapshot),
      updated_at: new Date().toISOString()
    })
    if (error) {
      console.error('[snapshot:write] upsert FAILED for room', roomId, ':', error)
    } else {
      console.log('[snapshot:write] upsert OK for room', roomId)
    }
  }, 5000))
}

async function initRoom(roomId: string): Promise<RoomState> {
  console.log('[room:init] ── START ── room', roomId)
  const doc = new Y.Doc()

  // Register the shapes map so the doc is ready to receive shape updates immediately.
  // Mirrors the client's ydoc.getMap('shapes') so the root shared type
  // exists in doc.share before any update is applied.
  doc.getMap('shapes')

  // ── Step 1: query snapshot ──────────────────────────────────────────────────
  const { data: snap, error: snapError } = await db
    .from('yjs_snapshots')
    .select('snapshot')
    .eq('room_id', roomId)
    .single()

  const hasSnapshot = !!(snap?.snapshot)
  console.log(`[room:init] snapshot query → hasData=${hasSnapshot} errorCode=${snapError?.code ?? 'none'}`)

  // ── Step 2: decode + apply snapshot ────────────────────────────────────────
  if (hasSnapshot) {
    let bytes: Uint8Array
    try {
      bytes = decodeSnapshotFromDB(snap!.snapshot)
    } catch (decodeErr) {
      console.error('[room:init] decodeSnapshotFromDB threw — starting empty:', decodeErr)
      bytes = new Uint8Array(0)
    }

    console.log(`[room:init] decoded snapshot → ${bytes.length} bytes`)

    if (bytes.length < 2) {
      // A valid Yjs update is at minimum 2 bytes (0-struct-count + 0-deleteSet-count).
      // Less than 2 means either empty buffer or decode failed silently.
      console.error(`[room:init] decoded bytes too short (${bytes.length}) — skipping applyUpdate, doc will be empty`)
    } else {
      try {
        Y.applyUpdate(doc, bytes)
        const sv = decodeSV(Y.encodeStateVector(doc))
        const clientCount = Object.keys(sv).length
        console.log(`[room:init] Y.applyUpdate OK — clientCount=${clientCount} sv=${JSON.stringify(sv)}`)
        if (clientCount === 0) {
          console.error(`[room:init] WARNING: state vector is empty after applying ${bytes.length}-byte snapshot — update contained no structs. Possible causes: old-format snapshot, corrupt data, or pointer-only data stored before filter fix.`)
        }
      } catch (applyErr) {
        console.error('[room:init] Y.applyUpdate threw — doc will be empty:', applyErr)
      }
    }
  }

  // ── Step 3: load recent edit windows ───────────────────────────────────────
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

  const finalSV = decodeSV(Y.encodeStateVector(doc))
  console.log(`[room:init] ── DONE ── room ${roomId} | sv=${JSON.stringify(finalSV)}`)
  return state
}

export async function getOrCreateRoom(roomId: string): Promise<RoomState> {
  if (rooms.has(roomId)) {
    // Room is alive in memory — no DB read needed
    console.log('[room:cache] HIT for room', roomId)
    return rooms.get(roomId)!
  }

  // If another async call is already initialising this room, wait for it rather
  // than spawning a second initRoom that would overwrite rooms with a fresh Y.Doc.
  const existing = roomInitLocks.get(roomId)
  if (existing) {
    console.log('[room:cache] MISS — joining in-flight init for room', roomId)
    return existing
  }

  console.log('[room:cache] MISS — starting cold init for room', roomId)
  const promise = initRoom(roomId).finally(() => roomInitLocks.delete(roomId))
  roomInitLocks.set(roomId, promise)
  return promise
}

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId)
}

setInterval(async () => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.clients.size === 0 && Date.now() - room.lastActivityAt > 5 * 60_000) {
      const snapshot = Y.encodeStateAsUpdate(room.doc)
      console.log('[room:evict] persisting', snapshot.length, 'bytes and evicting room', roomId)
      const { error } = await db.from('yjs_snapshots').upsert({
        room_id: roomId, snapshot: encodeSnapshotForDB(snapshot), updated_at: new Date().toISOString()
      })
      if (error) console.error('[room:evict] upsert FAILED for room', roomId, ':', error)
      clearTimeout(persistTimers.get(roomId))
      persistTimers.delete(roomId)
      rooms.delete(roomId)
    }
  }
}, 60_000)

process.on('SIGTERM', async () => {
  console.log('[shutdown] SIGTERM — flushing all rooms')
  for (const t of persistTimers.values()) clearTimeout(t)
  persistTimers.clear()
  for (const [roomId, { doc }] of rooms.entries()) {
    const snapshot = Y.encodeStateAsUpdate(doc)
    const { error } = await db.from('yjs_snapshots').upsert({
      room_id: roomId, snapshot: encodeSnapshotForDB(snapshot), updated_at: new Date().toISOString()
    })
    if (error) console.error('[shutdown] upsert FAILED for room', roomId, ':', error)
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
  console.log('[mutation] applying', yjsUpdate.length, 'bytes for node', nodeId, 'in room', roomId)

  try {
    Y.applyUpdate(room.doc, yjsUpdate)
    const sv = decodeSV(Y.encodeStateVector(room.doc))
    console.log('[mutation] applied OK — sv:', JSON.stringify(sv))
  } catch (err) {
    console.error('[mutation] Y.applyUpdate FAILED:', err)
    try { fromSocket.send(JSON.stringify({ type: 'error:malformed_update', payload: {} })) } catch {}
    return
  }

  room.lastActivityAt = Date.now()

  const { data: event } = await writeEvent(roomId, fromSocket.userId, 'node:updated', nodeId, { textSnapshot })

  if (event && textSnapshot) {
    scheduleTask(roomId, nodeId, fromSocket.userId)
    recordEdit(roomId, nodeId, fromSocket.userId, textSnapshot, room.editWindows)
  }

  scheduleSnapshot(roomId, room.doc)
  console.log('[mutation] broadcasting to room', roomId, '(except sender)')
  broadcastToRoom(roomId, {
    type: 'mutation:broadcast',
    payload: { yjsUpdate: Array.from(yjsUpdate), nodeId }
  }, fromSocket)
}
