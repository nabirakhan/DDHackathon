import type { WSServerMessage, AuthSocket } from '@shared/types'
import { rooms } from './yjsHandler.js'

export function broadcastToRoom(roomId: string, msg: WSServerMessage, except?: AuthSocket) {
  const room = rooms.get(roomId)
  if (!room) return
  const payload = JSON.stringify(msg)
  for (const c of room.clients) {
    if (c !== except && c.readyState === c.OPEN) c.send(payload)
  }
}
