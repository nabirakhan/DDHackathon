import * as Y from 'yjs'
import type { RoomJoinMessage } from '@shared/types'
import type { AuthSocket } from './types.js'
import { db } from '../db/supabase.js'
import { getOrCreateRoom, rooms, decodeSV } from './yjsHandler.js'
import { getMembership } from '../middleware/rbac.js'
import { broadcastToRoom } from './hub.js'
import { deflate, inflate } from 'zlib'
import { promisify } from 'util'

const deflateAsync = promisify(deflate)

function send(socket: AuthSocket, msg: unknown) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
}

async function compressSnapshot(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length < 5000) return bytes
  try {
    const compressed = await deflateAsync(Buffer.from(bytes))
    if (compressed.length < bytes.length - 100) {
      return new Uint8Array(compressed)
    }
    return bytes
  } catch {
    return bytes
  }
}

export async function handleRoomJoin(socket: AuthSocket, payload: RoomJoinMessage['payload']) {
  let role = await getMembership(socket.userId, payload.roomId)
  let isNewMember = false

  if (!role) {
    const { data: roomData } = await db.from('rooms').select('created_by').eq('id', payload.roomId).single()
    const defaultRole = roomData?.created_by === socket.userId ? 'lead' : 'viewer'
    
    await db.from('room_members').insert({
      room_id: payload.roomId,
      user_id: socket.userId,
      role: defaultRole
    })
    role = defaultRole
    isNewMember = true
  }

  if (payload.displayName) socket.displayName = payload.displayName

  if (socket.roomId && socket.roomId !== payload.roomId) {
    rooms.get(socket.roomId)?.clients.delete(socket)
  }

  const room = await getOrCreateRoom(payload.roomId)
  room.clients.add(socket)
  socket.roomId = payload.roomId

  if (isNewMember) {
    broadcastToRoom(payload.roomId, {
      type: 'member:joined',
      payload: { userId: socket.userId, role: role, displayName: payload.displayName }
    }, socket)
  }

  if (!room.sessionStartedAt) {
    const ts = new Date().toISOString()
    await db.from('rooms').update({ session_started_at: ts })
      .eq('id', payload.roomId).is('session_started_at', null)
    room.sessionStartedAt = ts
  }

  const sv = payload.clientStateVector.length
    ? new Uint8Array(payload.clientStateVector) : undefined

  const fullUpdate = Y.encodeStateAsUpdate(room.doc)
  let diff: Uint8Array
  
  if (sv && sv.length > 0) {
    diff = Y.encodeStateAsUpdate(room.doc, sv)
  } else {
    diff = new Uint8Array(0)
  }

  const shouldSendFull = diff.length === 0 || diff.length > fullUpdate.length * 0.7 || fullUpdate.length < 5000

  const { count: decisionCount } = await db.from('node_acl')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', payload.roomId)
    .eq('is_locked', true)

  const awarenessStates = Array.from(room.clients)
    .filter(c =>
      c !== socket &&
      c.lastAwareness &&
      c.lastAwarenessAt &&
      Date.now() - c.lastAwarenessAt < 10000 &&
      c.userId
    )
    .map(c => ({ userId: c.userId!, displayName: c.displayName, ...c.lastAwareness! }))

  if (shouldSendFull) {
    const compressed = await compressSnapshot(fullUpdate)
    const isCompressed = compressed !== fullUpdate
    
    send(socket, {
      type: 'room:joined',
      payload: {
        yjsDiff: Array.from(compressed),
        isCompressed,
        sessionStartedAt: room.sessionStartedAt,
        decisionCount: decisionCount ?? 0,
        awarenessStates
      }
    })
  } else {
    send(socket, {
      type: 'room:joined',
      payload: {
        yjsDiff: Array.from(diff),
        isCompressed: false,
        sessionStartedAt: room.sessionStartedAt,
        decisionCount: decisionCount ?? 0,
        awarenessStates
      }
    })
  }
}