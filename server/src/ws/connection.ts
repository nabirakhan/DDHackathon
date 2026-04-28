import type { WSClientMessage } from '@shared/types'
import type { AuthSocket } from './types.js'
import { db } from '../db/supabase.js'
import { checkPermission, getMembership, aclCache } from '../middleware/rbac.js'
import { applyMutation } from './yjsHandler.js'
import { handleRoomJoin } from './replayHandler.js'
import { broadcastToRoom } from './hub.js'

function send(socket: AuthSocket, msg: unknown) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
}

export async function handleMessage(socket: AuthSocket, msg: WSClientMessage) {
  console.log('WS message received:', msg.type, 'from user:', socket.userId)
  switch (msg.type) {
    case 'room:join': {
      await handleRoomJoin(socket, msg.payload)
      break
    }

    case 'mutation:apply': {
      const ok = await checkPermission(socket, msg)
      if (!ok) return
      await applyMutation(
        msg.payload.roomId,
        socket,
        new Uint8Array(msg.payload.yjsUpdate),
        msg.payload.nodeId,
        msg.payload.textSnapshot
      )
      break
    }

    case 'awareness:update': {
      const now = Date.now()
      if (now - (socket.lastAwarenessAt ?? 0) < 33) return
      socket.lastAwarenessAt = now
      socket.lastAwareness = msg.payload
      if (!socket.roomId) return
      broadcastToRoom(socket.roomId, {
        type: 'awareness:broadcast',
        payload: { ...msg.payload, userId: socket.userId }
      }, socket)
      break
    }

    case 'decision:lock': {
      const role = await getMembership(socket.userId, msg.payload.roomId)
      if (role !== 'lead') {
        send(socket, { type: 'error:permission_denied', payload: { code: 'INSUFFICIENT_ROLE' } })
        return
      }
      await db.from('node_acl').upsert({
        room_id: msg.payload.roomId,
        node_id: msg.payload.nodeId,
        required_role: 'lead',
        is_locked: true,
        locked_by: socket.userId
      }, { onConflict: 'room_id,node_id' })
      aclCache.delete(`${msg.payload.roomId}:${msg.payload.nodeId}`)
      await db.from('contested_nodes')
        .update({ resolved_at: new Date().toISOString(), resolution: 'locked_as_decision' })
        .eq('room_id', msg.payload.roomId)
        .eq('node_id', msg.payload.nodeId)
        .is('resolved_at', null)
      broadcastToRoom(msg.payload.roomId, {
        type: 'node:decision_locked',
        payload: { nodeId: msg.payload.nodeId }
      })
      break
    }

    case 'node:lock_request': {
      const role = await getMembership(socket.userId, msg.payload.roomId)
      if (role !== 'lead') {
        send(socket, { type: 'error:permission_denied', payload: { code: 'INSUFFICIENT_ROLE' } })
        return
      }
      await db.from('node_acl').upsert({
        room_id: msg.payload.roomId,
        node_id: msg.payload.nodeId,
        required_role: msg.payload.required_role,
        is_locked: false,
        locked_by: socket.userId
      }, { onConflict: 'room_id,node_id' })
      aclCache.delete(`${msg.payload.roomId}:${msg.payload.nodeId}`)
      break
    }

    case 'vote:cast': {
      const role = await getMembership(socket.userId, msg.payload.roomId)
      if (!role) {
        send(socket, { type: 'error:permission_denied', payload: { code: 'NOT_A_MEMBER' } })
        return
      }
      const { data, error } = await db.rpc('vote_on_contest', {
        p_room_id: msg.payload.roomId,
        p_node_id: msg.payload.nodeId,
        p_voter_id: socket.userId,
        p_voted_for: msg.payload.votedForUserId,
      })
      if (error) {
        send(socket, { type: 'error:internal', payload: {} })
        return
      }
      if (data === 'already_resolved') {
        send(socket, { type: 'error:contest_resolved', payload: {} })
        return
      }
      broadcastToRoom(msg.payload.roomId, {
        type: 'vote:updated',
        payload: {
          nodeId: msg.payload.nodeId,
          voterId: socket.userId,
          votedFor: msg.payload.votedForUserId
        }
      })
      break
    }
  }
}
