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
  const pendingBatch = useRef<Array<[string, unknown, 'add' | 'update' | 'remove']>>([])
  const rafId = useRef<number | null>(null)

  useEffect(() => { editorRef.current = editor }, [editor])

  // Outbound: batch all store changes within one animation frame into a single yjs transaction
  useEffect(() => {
    if (!store) return

    const flush = () => {
      rafId.current = null
      const batch = pendingBatch.current.splice(0)
      if (!batch.length) return

      const lastNonRemove = batch.findLast(([, , kind]) => kind !== 'remove') ?? batch[batch.length - 1]
      metaQueue.current.push({
        nodeId: lastNonRemove[0],
        textSnapshot: extractShapeText(lastNonRemove[1]),
      })

      ydoc.transact(() => {
        for (const [id, shape, kind] of batch) {
          if (kind === 'remove') yShapes.delete(id)
          else yShapes.set(id, shape as Parameters<typeof yShapes.set>[1])
        }
      }, 'local')
    }

    const unlisten = store.listen(({ changes }) => {
      if (isApplyingRemote.current) return

      Object.entries(changes.added).forEach(([id, shape]) => {
        if (NON_DOCUMENT_TYPES.has((shape as any).typeName ?? '')) return
        pendingBatch.current.push([id, shape, 'add'])
      })
      Object.entries(changes.updated).forEach(([, [, shape]]) => {
        if (NON_DOCUMENT_TYPES.has((shape as any).typeName ?? '')) return
        pendingBatch.current.push([(shape as any).id, shape, 'update'])
      })
      Object.values(changes.removed).forEach(shape => {
        if (NON_DOCUMENT_TYPES.has((shape as any).typeName ?? '')) return
        pendingBatch.current.push([(shape as any).id, shape, 'remove'])
      })

      if (pendingBatch.current.length > 0) {
        if (rafId.current) cancelAnimationFrame(rafId.current)
        rafId.current = requestAnimationFrame(flush)
      }
    })

    return () => {
      unlisten()
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [store, ydoc, yShapes])

  // Inbound: only apply the shapes that actually changed (keysChanged), not all shapes
  useEffect(() => {
    const observer = (event: Y.YMapEvent<any>) => {
      if (event.transaction.origin === 'local') return

      isApplyingRemote.current = true
      try {
        const editingId = editorRef.current?.getEditingShapeId()

        const removed = Array.from(event.keysChanged)
          .filter(k => !yShapes.has(k)) as TLShapeId[]
        if (removed.length && store) store.remove(removed)

        const changed = Array.from(event.keysChanged)
          .filter(k => yShapes.has(k) && k !== editingId)
          .map(k => yShapes.get(k)!)

        if (store && changed.length > 0) {
          store.mergeRemoteChanges(() => {
            store.put(changed as Parameters<typeof store.put>[0])
          })
        }
      } catch (err) {
        console.error('[yjs:observe] ERROR:', err)
      } finally {
        isApplyingRemote.current = false
      }
    }

    yShapes.observe(observer)
    return () => yShapes.unobserve(observer)
  }, [yShapes, store])

  // Inbound WebSocket messages
  useEffect(() => {
    const unsub = wsClient.on((msg) => {
      if (msg.type === 'mutation:broadcast') {
        const bytes = new Uint8Array(msg.payload.yjsUpdate)
        try {
          Y.applyUpdate(ydoc, bytes, 'remote')
        } catch (err) {
          console.error('[ws:inbound] applyUpdate threw:', err)
        }
      }

      if (msg.type === 'room:joined') {
        void (async () => {
          const raw = new Uint8Array(msg.payload.yjsDiff)
          let bytes = raw
          if (msg.payload.isCompressed && raw.length > 0) {
            try {
              const ds = new DecompressionStream('deflate')
              const writer = ds.writable.getWriter()
              const reader = ds.readable.getReader()
              writer.write(raw)
              writer.close()
              const chunks: Uint8Array[] = []
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                chunks.push(value)
              }
              const total = chunks.reduce((s, c) => s + c.length, 0)
              bytes = new Uint8Array(total)
              let offset = 0
              for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
            } catch (err) {
              console.error('[ws:inbound] decompression failed:', err)
            }
          }
          try {
            if (bytes.length > 0) Y.applyUpdate(ydoc, bytes, 'remote')
          } catch (err) {
            console.error('[ws:inbound] room:joined applyUpdate threw:', err)
          }
          setRoomReady(true)
        })()
        return
      }

      if (msg.type === 'error:permission_denied') {
        const code = msg.payload.code
        if (code === 'INSUFFICIENT_ROLE') {
          toast.error('You need contributor access to edit. Ask the lead to promote you.')
        } else if (code === 'NODE_LOCKED') {
          toast.warning('This node is locked as a decision.')
        }
      }
    })
    return unsub
  }, [ydoc, setRoomReady])

  // Outbound: send batched yjs update over WebSocket
  useEffect(() => {
    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin !== 'local') return
      const meta = metaQueue.current.shift()
      if (!meta) return
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
