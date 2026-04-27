import { supabase } from './supabase'
import type { WSClientMessage, WSServerMessage } from '@shared/types'

type Listener = (msg: WSServerMessage) => void
const listeners = new Set<Listener>()

let currentWs: WebSocket | null = null
let pendingQueue: WSClientMessage[] = []
let isRefreshing = false
let attempt = 0

const getWS = () => currentWs
const backoff = () => Math.min(30_000, 1000 * 2 ** attempt++)

function drainQueue() {
  const q = pendingQueue
  pendingQueue = []
  q.forEach(m => wsClient.send(m))
}

export const wsClient = {
  send(msg: WSClientMessage) {
    const ws = getWS()
    if (isRefreshing || !ws || ws.readyState !== WebSocket.OPEN) {
      pendingQueue.push(msg)
      return
    }
    ws.send(JSON.stringify(msg))
  },

  on(fn: Listener) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  connect(url: string) {
    const ws = new WebSocket(url)
    currentWs = ws

    ws.onopen = async () => {
      attempt = 0
      const { data: { session } } = await supabase.auth.getSession()
      ws.send(JSON.stringify({ type: 'auth', payload: { token: session?.access_token ?? '' } }))
      drainQueue()
    }

    ws.onmessage = (e) => {
      const msg: WSServerMessage = JSON.parse(e.data)
      if (msg.type === 'auth:refreshed') {
        isRefreshing = false
        drainQueue()
      }
      listeners.forEach(l => l(msg))
    }

    ws.onclose = () => {
      currentWs = null
      setTimeout(() => wsClient.connect(url), backoff())
    }

    ws.onerror = () => ws.close()
  },

  getReadyState: () => getWS()?.readyState ?? WebSocket.CLOSED,
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && session) {
    isRefreshing = true
    wsClient.send({ type: 'auth:refresh', payload: { token: session.access_token } })
  }
})
