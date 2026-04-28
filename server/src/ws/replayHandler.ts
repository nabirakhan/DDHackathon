import * as Y from 'yjs'
import type { AuthSocket, RoomJoinMessage } from '@shared/types'
import { db } from '../db/supabase.js'
import { getOrCreateRoom, rooms, decodeSV } from './yjsHandler.js'
import { getMembership } from '../middleware/rbac.js'

function send(socket: AuthSocket, msg: unknown) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
}

export async function handleRoomJoin(socket: AuthSocket, payload: RoomJoinMessage['payload']) {
  let role = await getMembership(socket.userId, payload.roomId)
  if (!role) {
    await db.from('room_members').insert({
      room_id: payload.roomId,
      user_id: socket.userId,
      role: 'viewer'
    })
    role = 'viewer'
  }

  if (socket.roomId && socket.roomId !== payload.roomId) {
    rooms.get(socket.roomId)?.clients.delete(socket)
  }

  // getOrCreateRoom logs "cache HIT" or "cold init" so we can see which path ran
  const room = await getOrCreateRoom(payload.roomId)
  room.clients.add(socket)
  socket.roomId = payload.roomId

  if (!room.sessionStartedAt) {
    const ts = new Date().toISOString()
    await db.from('rooms').update({ session_started_at: ts })
      .eq('id', payload.roomId).is('session_started_at', null)
    room.sessionStartedAt = ts
  }

  const sv = payload.clientStateVector.length
    ? new Uint8Array(payload.clientStateVector) : undefined

  const clientSVDecoded = sv ? decodeSV(sv) : {}
  const docSV = decodeSV(Y.encodeStateVector(room.doc))
  const fullUpdate = Y.encodeStateAsUpdate(room.doc)
  const diff = Y.encodeStateAsUpdate(room.doc, sv)

  console.log(
    `[replay] room:joined for ${payload.roomId}` +
    `\n  clientSV (decoded): ${JSON.stringify(clientSVDecoded)}` +
    `\n  docSV    (decoded): ${JSON.stringify(docSV)}` +
    `\n  fullUpdate (no sv): ${fullUpdate.length} bytes` +
    `\n  diff   (with sv):   ${diff.length} bytes` +
    `\n  clientCount in doc: ${Object.keys(docSV).length}`
  )

  if (diff.length <= 2) {
    console.warn('[replay] WARNING: diff is ≤2 bytes — server is sending no content to client.')
    if (fullUpdate.length > 2) {
      console.warn('[replay] CAUSE: fullUpdate has', fullUpdate.length, 'bytes but client SV already covers it — client sent a stale/non-empty state vector. clientSV:', JSON.stringify(clientSVDecoded))
    } else {
      console.warn('[replay] CAUSE: server doc itself is empty (fullUpdate ≤2 bytes) — snapshot not loaded or room evicted.')
    }
  }

  const { count: decisionCount } = await db.from('node_acl')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', payload.roomId)
    .eq('is_locked', true)

  const awarenessStates = Array.from(room.clients)
    .filter(c =>
      c !== socket &&
      c.lastAwareness &&
      c.lastAwarenessAt &&
      Date.now() - c.lastAwarenessAt < 10_000 &&
      c.userId
    )
    .map(c => ({ userId: c.userId!, ...c.lastAwareness! }))

  send(socket, {
    type: 'room:joined',
    payload: {
      yjsDiff: Array.from(diff),
      sessionStartedAt: room.sessionStartedAt,
      decisionCount: decisionCount ?? 0,
      awarenessStates
    }
  })
}
