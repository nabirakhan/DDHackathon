import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { Editor } from 'tldraw'
import { wsClient } from '../lib/wsClient'
import { supabase } from '../lib/supabase'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

export function useLockedShapes(editor: Editor | null, roomId: string) {
  const lockedIds = useRef(new Set<string>())
  const toastAt = useRef(new Map<string, number>())

  // Load initially locked nodes
  useEffect(() => {
    if (!roomId) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch(`${SERVER_URL}/rooms/${roomId}/locked-nodes`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(json => { lockedIds.current = new Set(json.lockedNodes ?? []) })
        .catch(() => {})
    })
  }, [roomId])

  // Track lock/unlock events
  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'node:decision_locked') lockedIds.current.add(msg.payload.nodeId)
      if (msg.type === 'node:unlocked') lockedIds.current.delete(msg.payload.nodeId)
    })
  }, [])

  // Intercept shape changes for locked nodes — return prev to cancel
  useEffect(() => {
    if (!editor) return
    return editor.sideEffects.registerBeforeChangeHandler('shape', (prev, next) => {
      if (!lockedIds.current.has(next.id)) return next
      const last = toastAt.current.get(next.id) ?? 0
      if (Date.now() - last > 3000) {
        toastAt.current.set(next.id, Date.now())
        toast.error('This node is locked as a decision.', { duration: 2000 })
      }
      return prev
    })
  }, [editor])
}
