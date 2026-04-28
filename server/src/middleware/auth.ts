import { WebSocketServer } from 'ws'
import { db } from '../db/supabase.js'
import { roleCache } from './rbac.js'
import { handleMessage } from '../ws/connection.js'
import type { WSServerMessage, AuthSocket } from '@shared/types'

function send(socket: AuthSocket, msg: WSServerMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
}

export function attachAuth(wss: WebSocketServer) {
  wss.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthSocket
    let authenticated = false
    const timer = setTimeout(() => {
      if (!authenticated) socket.close(4001, 'Auth timeout')
    }, 5000)

    socket.on('message', async (data: Buffer | ArrayBuffer | Buffer[]) => {
      let msg: { type: string; payload: { token: string } }
      try { msg = JSON.parse(data.toString()) } catch { return }

      if (msg.type === 'auth' || msg.type === 'auth:refresh') {
        clearTimeout(timer)
        const { data: { user } } = await db.auth.getUser(msg.payload.token)
        if (!user) { socket.close(4001, 'Invalid token'); return }
        socket.userId = user.id
        authenticated = true
        if (msg.type === 'auth:refresh') {
          if (socket.roomId) roleCache.delete(`${socket.userId}:${socket.roomId}`)
        }
        // Always send auth:refreshed so the client knows it's safe to drain its
        // pending message queue (room:join etc). Without this, the client drains
        // immediately in ws.onopen and room:join races against the auth await,
        // causing the server to close the socket with 4001 "Not authenticated".
        send(socket, { type: 'auth:refreshed' })
        console.log('[auth] authenticated userId:', socket.userId, 'type:', msg.type)
        return
      }

      if (!authenticated) { socket.close(4001, 'Not authenticated'); return }
      handleMessage(socket, msg as Parameters<typeof handleMessage>[1])
    })

    socket.on('close', async () => {
      if (socket.roomId) {
        const { rooms } = await import('../ws/yjsHandler.js')
        const room = rooms.get(socket.roomId)
        room?.clients.delete(socket)
        const { broadcastToRoom } = await import('../ws/hub.js')
        if (socket.userId) {
          broadcastToRoom(socket.roomId, { type: 'awareness:peer_left', payload: { userId: socket.userId } })
        }
      }
    })
  })
}
