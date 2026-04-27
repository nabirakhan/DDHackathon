import * as Y from 'yjs'
import type { AuthSocket, RoomJoinMessage } from '@shared/types'
import { db } from '../db/supabase.js'
import { getOrCreateRoom, rooms } from './yjsHandler.js'
import { getMembership } from '../middleware/rbac.js'

function send(socket: AuthSocket, msg: unknown) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
}

export async function handleRoomJoin(socket: AuthSocket, payload: RoomJoinMessage['payload']) {
  const role = await getMembership(socket.userId, payload.roomId)
  if (!role) {
    send(socket, { type: 'error:permission_denied', payload: { code: 'NOT_A_MEMBER' } })
    return
  }

  if (socket.roomId && socket.roomId !== payload.roomId) {
    rooms.get(socket.roomId)?.clients.delete(socket)
  }

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
  const diff = Y.encodeStateAsUpdate(room.doc, sv)

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
