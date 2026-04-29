import { useEffect, useRef } from 'react'
import type { Editor } from 'tldraw'
import { toast } from 'sonner'
import { wsClient } from '../lib/wsClient'
import { supabase } from '../lib/supabase'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

export function useLockedShapes(editor: Editor | null, roomId: string) {
  const lockedNodeIds = useRef(new Set<string>())
  const toastAt = useRef(new Map<string, number>())

  // Block changes to locked shapes at the tldraw level — before they reach the store or Yjs
  useEffect(() => {
    if (!editor) return
    return editor.sideEffects.registerBeforeChangeHandler('shape', (prev, next) => {
      if (!lockedNodeIds.current.has(next.id)) return next
      const last = toastAt.current.get(next.id) ?? 0
      if (Date.now() - last > 3000) {
        toastAt.current.set(next.id, Date.now())
        toast.error('This node is locked as a decision.', { duration: 2000 })
      }
      return prev
    })
  }, [editor])

  // Fetch existing locks on mount; delay 1.5s to let Yjs initial state settle
  useEffect(() => {
    if (!editor) return
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) return
      fetch(`${SERVER_URL}/rooms/${roomId}/locked-nodes`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(({ lockedNodes }) => {
          if (cancelled) return
          setTimeout(() => {
            for (const id of (lockedNodes ?? [])) lockedNodeIds.current.add(id)
          }, 1500)
        })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [editor, roomId])

  // Realtime lock/unlock events
  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'node:decision_locked') lockedNodeIds.current.add(msg.payload.nodeId)
      if (msg.type === 'node:unlocked') lockedNodeIds.current.delete(msg.payload.nodeId)
    })
  }, [])
}
