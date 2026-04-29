import { useEffect } from 'react'
import type { Editor, TLShapeId } from 'tldraw'
import { wsClient } from '../lib/wsClient'
import { supabase } from '../lib/supabase'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

function applyShapeLock(editor: Editor, nodeId: string, locked: boolean, text?: string) {
  const shape = editor.getShape(nodeId as TLShapeId)
  if (!shape) return
  editor.store.mergeRemoteChanges(() => {
    const update: Record<string, unknown> = { id: shape.id, type: shape.type, isLocked: locked }
    if (locked && text !== undefined) {
      const props = (shape as any).props ?? {}
      if ('text' in props) update.props = { ...props, text }
    }
    editor.updateShapes([update as any])
  })
}

function applyShapeLockRetry(editor: Editor, nodeId: string, locked: boolean, text?: string) {
  applyShapeLock(editor, nodeId, locked, text)
  // Retry once after 2s in case Yjs hasn't populated the shape yet on initial load
  setTimeout(() => applyShapeLock(editor, nodeId, locked, text), 2000)
}

export function useLockedShapes(editor: Editor | null, roomId: string) {
  // Fetch existing locks on mount and apply them
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
          // Delay slightly to let Yjs initial state settle
          setTimeout(() => {
            for (const nodeId of (lockedNodes ?? [])) {
              applyShapeLock(editor, nodeId, true)
            }
          }, 1500)
        })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [editor, roomId])

  // Listen for realtime lock/unlock events
  useEffect(() => {
    if (!editor) return
    return wsClient.on((msg) => {
      if (msg.type === 'node:decision_locked') {
        applyShapeLockRetry(editor, msg.payload.nodeId, true, msg.payload.text)
      }
      if (msg.type === 'node:unlocked') {
        applyShapeLock(editor, msg.payload.nodeId, false)
      }
    })
  }, [editor])
}
