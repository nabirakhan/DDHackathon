import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { Editor } from 'tldraw'
import { wsClient } from '../lib/wsClient'
import { supabase } from '../lib/supabase'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

async function fetchLocked(roomId: string): Promise<string[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []
  const res = await fetch(`${SERVER_URL}/rooms/${roomId}/locked-nodes`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.lockedNodes ?? []
}

export function useLockedShapes(editor: Editor | null, roomId: string) {
  const lockedIds = useRef(new Set<string>())
  const toastAt = useRef(new Map<string, number>())

  // Fetch on mount; retry once auth is ready if first attempt returns empty
  useEffect(() => {
    if (!roomId) return
    fetchLocked(roomId).then(nodes => {
      nodes.forEach(n => lockedIds.current.add(n))
    })
    // Also retry when auth state settles (anonymous sign-in may happen after mount)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchLocked(roomId).then(nodes => {
        lockedIds.current = new Set(nodes)
      })
    })
    return () => subscription.unsubscribe()
  }, [roomId])

  // Track lock/unlock via WS
  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'node:decision_locked') lockedIds.current.add(msg.payload.nodeId)
      if (msg.type === 'node:unlocked') lockedIds.current.delete(msg.payload.nodeId)
    })
  }, [])

  // Block LOCAL changes to locked shapes; allow remote (Yjs) changes through
  useEffect(() => {
    if (!editor) return
    return editor.sideEffects.registerBeforeChangeHandler('shape', (prev, next, source) => {
      if (source === 'remote') return next
      if (!lockedIds.current.has(next.id)) return next
      const last = toastAt.current.get(next.id) ?? 0
      if (Date.now() - last > 3000) {
        toastAt.current.set(next.id, Date.now())
        toast.warning('This node is locked as a decision.', { duration: 2000 })
      }
      return prev
    })
  }, [editor])
}
