import type { AwarenessState } from '@shared/types'

declare module 'ws' {
  interface WebSocket {
    userId?: string
    roomId?: string
    displayName?: string
    lastAwarenessAt?: number
    lastAwareness?: AwarenessState
  }
}

export type AuthSocket = import('ws').WebSocket & {
  userId: string
  roomId?: string
  displayName?: string
  lastAwarenessAt?: number
  lastAwareness?: AwarenessState
}
