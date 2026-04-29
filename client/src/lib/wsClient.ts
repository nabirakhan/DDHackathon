// client/src/lib/wsClient.ts
import { supabase } from './supabase'
import type { WSClientMessage, WSServerMessage } from '@shared/types'

type Listener = (msg: WSServerMessage) => void
const listeners = new Set<Listener>()

let currentWs: WebSocket | null = null
let pendingQueue: WSClientMessage[] = []
let isRefreshing = false
let isAuthing = false
let attempt = 0
let pingInterval: ReturnType<typeof setInterval> | null = null
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

const getWS = () => currentWs
const backoff = () => Math.min(30000, 1000 * Math.pow(2, attempt++))

function drainQueue() {
  if (pendingQueue.length === 0) return
  const q = [...pendingQueue]
  pendingQueue = []
  q.forEach(m => wsClient.send(m))
}

function startPing(ws: WebSocket) {
  if (pingInterval) clearInterval(pingInterval)
  pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('ping')
    }
  }, 30000)
}

function stopPing() {
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }
}

export const wsClient = {
  send(msg: WSClientMessage) {
    const ws = getWS()
    if (isRefreshing || isAuthing || !ws || ws.readyState !== WebSocket.OPEN) {
      pendingQueue.push(msg)
      return
    }
    ws.send(JSON.stringify(msg))
  },

  on(fn: Listener): () => void {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },

  connect(url: string) {
    // Clean up existing connection
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    
    if (currentWs && currentWs.readyState === WebSocket.OPEN) {
      console.log('[ws] Already connected')
      return
    }
    
    console.log('[ws] connecting to', url)
    const ws = new WebSocket(url)
    currentWs = ws
    isAuthing = true

    ws.onopen = async () => {
      console.log('[ws] Connected successfully')
      attempt = 0
      startPing(ws)
      
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[ws] Sending auth, session present:', !!session)
        ws.send(JSON.stringify({ 
          type: 'auth', 
          payload: { token: session?.access_token ?? '' } 
        }))
      } catch (err) {
        console.error('[ws] Auth error:', err)
        ws.send(JSON.stringify({ type: 'auth', payload: { token: '' } }))
      }
    }

    ws.onmessage = (e) => {
      if (e.data === 'pong') return
      try {
        const msg: WSServerMessage = JSON.parse(e.data)
        console.log('[ws] Received:', msg.type)
        
        if (msg.type === 'auth:refreshed') {
          isRefreshing = false
          isAuthing = false
          drainQueue()
        }
        
        listeners.forEach(l => l(msg))
      } catch (err) {
        console.error('[ws] Parse error:', err)
      }
    }

    ws.onclose = (ev) => {
      console.log(`[ws] Closed - code: ${ev.code}, reason: ${ev.reason}, queued: ${pendingQueue.length}`)
      stopPing()
      currentWs = null
      isAuthing = false
      
      // Don't reconnect if unauthorized
      if (ev.code === 4001) {
        console.log('[ws] Unauthorized, redirecting to login')
        window.location.href = '/login'
        return
      }
      
      // Reconnect with backoff
      const delay = backoff()
      console.log(`[ws] Reconnecting in ${delay}ms...`)
      reconnectTimeout = setTimeout(() => wsClient.connect(url), delay)
    }

    ws.onerror = (err) => {
      console.error('[ws] Error:', err)
      ws.close()
    }
  },

  disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    const ws = getWS()
    stopPing()
    if (ws) {
      ws.onclose = null
      ws.close()
      currentWs = null
    }
    pendingQueue = []
    isAuthing = false
    isRefreshing = false
    attempt = 0
  },

  getReadyState: () => getWS()?.readyState ?? WebSocket.CLOSED,
}

// Handle auth state changes
let signedOutTimer: ReturnType<typeof setTimeout> | null = null
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[ws] Auth state change:', event)

  if (event === 'TOKEN_REFRESHED' && session) {
    isRefreshing = true
    wsClient.send({ type: 'auth:refresh', payload: { token: session.access_token } })
  }

  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    // Cancel any pending disconnect — anonymous auth fires SIGNED_OUT then SIGNED_IN during init
    if (signedOutTimer) { clearTimeout(signedOutTimer); signedOutTimer = null }
  }

  if (event === 'SIGNED_OUT') {
    // Debounce: only disconnect if not immediately followed by SIGNED_IN
    signedOutTimer = setTimeout(() => { signedOutTimer = null; wsClient.disconnect() }, 500)
  }
})