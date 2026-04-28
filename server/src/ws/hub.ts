import type { WSServerMessage } from '@shared/types'
import type { AuthSocket } from './types.js'
import { rooms } from './yjsHandler.js'

export function broadcastToRoom(roomId: string, msg: WSServerMessage, except?: AuthSocket) {
  const room = rooms.get(roomId)
  if (!room) {
    console.log(`[broadcast] room ${roomId} not in memory — skipping`)
    return
  }
  const payload = JSON.stringify(msg)
  let sent = 0
  for (const c of room.clients) {
    if (c !== except && c.readyState === c.OPEN) {
      c.send(payload)
      sent++
    }
  }
  console.log(`[broadcast] ${msg.type} → room=${roomId} recipients=${sent}/${room.clients.size} (except=${!!except})`)
}
