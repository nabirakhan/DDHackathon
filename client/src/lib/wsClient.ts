import { supabase } from './supabase'
import type { WSClientMessage, WSServerMessage } from '@shared/types'

type Listener = (msg: WSServerMessage) => void
const listeners = new Set<Listener>()

let currentWs: WebSocket | null = null
let pendingQueue: WSClientMessage[] = []
let isRefreshing = false
// True from the moment ws.onopen fires until the server replies with auth:refreshed.
// While true, wsClient.send queues rather than transmits, preventing room:join (and
// any other message) from reaching the server before authentication completes.
let isAuthing = false
let attempt = 0

const getWS = () => currentWs
const backoff = () => Math.min(30_000, 1000 * 2 ** attempt++)

function drainQueue() {
  const q = pendingQueue
  pendingQueue = []
  console.log('[ws] draining queue:', q.length, 'messages')
  q.forEach(m => wsClient.send(m))
}

export const wsClient = {
  send(msg: WSClientMessage) {
    const ws = getWS()
    if (isRefreshing || isAuthing || !ws || ws.readyState !== WebSocket.OPEN) {
      console.log('[ws] queuing message (isAuthing=%s isRefreshing=%s wsReady=%s):', isAuthing, isRefreshing, ws?.readyState, msg.type)
      pendingQueue.push(msg)
      return
    }
    console.log('[ws] sending immediately:', msg.type)
    ws.send(JSON.stringify(msg))
  },

  on(fn: Listener): () => void {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },

  connect(url: string) {
    const ws = new WebSocket(url)
    currentWs = ws
    // Block the queue until the server confirms auth — without this, room:join
    // arrives at the server while the auth await is still in-flight, which causes
    // the server to close the socket with code 4001 "Not authenticated".
    isAuthing = true
    console.log('[ws] connecting to', url)

    ws.onopen = async () => {
      attempt = 0
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[ws] open — sending auth, session present:', !!session)
      ws.send(JSON.stringify({ type: 'auth', payload: { token: session?.access_token ?? '' } }))
      // DO NOT call drainQueue() here — wait for auth:refreshed from the server.
      // Draining now sends room:join while the server's auth await is still pending,
      // causing a Not Authenticated close that silently drops room:join from the queue.
    }

    ws.onmessage = (e) => {
      const msg: WSServerMessage = JSON.parse(e.data)
      if (msg.type === 'auth:refreshed') {
        console.log('[ws] auth:refreshed received — clearing isAuthing=%s isRefreshing=%s, draining queue (%d msgs)', isAuthing, isRefreshing, pendingQueue.length)
        isRefreshing = false
        isAuthing = false
        drainQueue()
      }
      listeners.forEach(l => l(msg))
    }

    ws.onclose = (ev) => {
      console.log('[ws] closed — code:', ev.code, 'reason:', ev.reason, '| queued msgs:', pendingQueue.length)
      currentWs = null
      isAuthing = false  // reset so pending messages don't stay blocked indefinitely
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
