// client/src/hooks/useYjsBinding.ts
import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { toast } from 'sonner'
import type { TLShapeId } from 'tldraw'
import { useCanvas } from '../context/CanvasContext'
import { wsClient } from '../lib/wsClient'

interface PendingMeta { nodeId: string; textSnapshot?: string }

function extractRichText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; text?: string; content?: unknown[] }
  if (n.type === 'text') return n.text ?? ''
  return (n.content ?? []).map(extractRichText).join('')
}

function extractShapeText(shape: unknown): string | undefined {
  const props = (shape as { props?: Record<string, unknown> })?.props
  if (!props) return undefined
  if (typeof props.text === 'string' && props.text.trim()) return props.text.trim()
  if (props.richText) return extractRichText(props.richText).trim() || undefined
  return undefined
}

const NON_DOCUMENT_TYPES = new Set([
  'pointer',
  'instance',
  'instance_page_state',
  'instance_presence',
  'camera',
])

export function useYjsBinding(roomId: string) {
  const { store, ydoc, yShapes, setRoomReady, editor } = useCanvas()
  const isApplyingRemote = useRef(false)
  const metaQueue = useRef<PendingMeta[]>([])
  const editorRef = useRef(editor)
  useEffect(() => { editorRef.current = editor }, [editor])

  // Local store → Yjs → WS outbound
  useEffect(() => {
    return store.listen(({ changes }) => {
      if (isApplyingRemote.current) return

      const all: Array<[string, unknown, 'add' | 'update' | 'remove']> = []
      Object.entries(changes.added).forEach(([id, shape]) => all.push([id, shape, 'add']))
      Object.entries(changes.updated).forEach(([, [, shape]]) =>
        all.push([(shape as { id: string }).id, shape, 'update'])
      )
      Object.values(changes.removed).forEach(shape =>
        all.push([(shape as { id: string }).id, shape, 'remove'])
      )

      for (const [id, shape, kind] of all) {
        const typeName = (shape as { typeName?: string })?.typeName ?? ''
        if (NON_DOCUMENT_TYPES.has(typeName)) continue

        const text = extractShapeText(shape)
        metaQueue.current.push({ nodeId: id, textSnapshot: text })
        ydoc.transact(() => {
          if (kind === 'remove') yShapes.delete(id)
          else yShapes.set(id, shape as Parameters<typeof yShapes.set>[1])
        }, 'local')
      }
    })
  }, [store, ydoc, yShapes])

  // Yjs remote changes → tldraw store (Bug C: skip shape being actively edited)
  useEffect(() => {
    const observer = (event: Y.YMapEvent<any>) => {
      console.log('[yjs:observe] fired — origin:', event.transaction.origin, 'keysChanged:', [...event.keysChanged])
      if (event.transaction.origin === 'local') return

      isApplyingRemote.current = true
      try {
        const editingId = editorRef.current?.getEditingShapeId()

        const removed = Array.from(event.keysChanged)
          .filter(k => !yShapes.has(k)) as TLShapeId[]
        if (removed.length) store.remove(removed)

        const allShapes = Array.from(yShapes.values())
          .filter(s => (s as { id: string }).id !== editingId)

        if (editingId) {
          console.log('[yjs:observe] skipping active editing shape:', editingId)
        }

        store.mergeRemoteChanges(() => {
          store.put(allShapes as Parameters<typeof store.put>[0])
        })
      } catch (err) {
        console.error('[yjs:observe] ERROR in mergeRemoteChanges:', err)
      } finally {
        isApplyingRemote.current = false
      }
    }
    yShapes.observe(observer)
    return () => yShapes.unobserve(observer)
  }, [yShapes, store])

  // WS inbound → Yjs
  useEffect(() => {
    const unsub = wsClient.on((msg) => {
      if (msg.type === 'mutation:broadcast') {
        const bytes = new Uint8Array(msg.payload.yjsUpdate)
        console.log('[ws:inbound] mutation:broadcast —', bytes.length, 'bytes, nodeId:', msg.payload.nodeId)
        try {
          Y.applyUpdate(ydoc, bytes, 'remote')
        } catch (err) {
          console.error('[ws:inbound] applyUpdate threw:', err)
        }
      }

      if (msg.type === 'room:joined') {
        const bytes = new Uint8Array(msg.payload.yjsDiff)
        console.log('[ws:inbound] room:joined — yjsDiff bytes:', bytes.length)
        try {
          Y.applyUpdate(ydoc, bytes, 'remote')
        } catch (err) {
          console.error('[ws:inbound] room:joined applyUpdate threw:', err)
        }
        setRoomReady(true)
      }

      if (msg.type === 'error:permission_denied') {
        const code = msg.payload.code
        if (code === 'INSUFFICIENT_ROLE') {
          toast.error('You need contributor access to edit. Ask the lead to promote you.')
        } else if (code === 'NODE_LOCKED') {
          toast.warning('This node is locked as a decision.')
        }
        console.warn('[ws:inbound] permission denied:', code)
      }
    })
    return unsub
  }, [ydoc, yShapes, setRoomReady])

  // Yjs local updates → WS outbound
  useEffect(() => {
    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin !== 'local') return
      const meta = metaQueue.current.shift()
      if (!meta) return
      console.log('[ws:outbound] mutation:apply —', update.length, 'bytes, nodeId:', meta.nodeId)
      wsClient.send({
        type: 'mutation:apply',
        payload: {
          roomId,
          nodeId: meta.nodeId,
          yjsUpdate: Array.from(update),
          textSnapshot: meta.textSnapshot
        }
      })
    }
    ydoc.on('update', handler)
    return () => ydoc.off('update', handler)
  }, [ydoc, roomId])
}
