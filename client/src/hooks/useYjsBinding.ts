// client/src/hooks/useYjsBinding.ts
import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import type { TLShapeId } from 'tldraw'
import { useCanvas } from '../context/CanvasContext'
import { wsClient } from '../lib/wsClient'

interface PendingMeta { nodeId: string; textSnapshot?: string }

const NON_DOCUMENT_TYPES = new Set([
  'pointer',
  'instance',
  'instance_page_state',
  'instance_presence',
  'camera',
])

export function useYjsBinding(roomId: string) {
  const { store, ydoc, yShapes } = useCanvas()
  const isApplyingRemote = useRef(false)
  const metaQueue = useRef<PendingMeta[]>([])

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
        if (NON_DOCUMENT_TYPES.has(typeName)) {
          console.log('[yjs:filter] skipping non-document type:', typeName, id)
          continue
        }

        const text = ((shape as { props?: { text?: string } })?.props?.text)
        metaQueue.current.push({ nodeId: id, textSnapshot: text })
        ydoc.transact(() => {
          if (kind === 'remove') yShapes.delete(id)
          else yShapes.set(id, shape as Parameters<typeof yShapes.set>[1])
        }, 'local')
      }
    })
  }, [store, ydoc, yShapes])

  useEffect(() => {
    const observer = (event: Y.YMapEvent<any>) => {
      console.log('[yjs:observe] fired — origin:', event.transaction.origin, 'keysChanged:', [...event.keysChanged], 'yShapes.size:', yShapes.size)
      if (event.transaction.origin === 'local') {
        console.log('[yjs:observe] skipping local origin')
        return
      }
      isApplyingRemote.current = true
      try {
        const removed = Array.from(event.keysChanged).filter(k => !yShapes.has(k)) as TLShapeId[]
        if (removed.length) {
          console.log('[yjs:observe] removing shapes:', removed)
          store.remove(removed)
        }
        const allShapes = Array.from(yShapes.values())
        const typeBreakdown = allShapes.reduce((acc, s) => {
          const tn = (s as { typeName?: string })?.typeName ?? 'unknown'
          acc[tn] = (acc[tn] ?? 0) + 1
          return acc
        }, {} as Record<string, number>)
        console.log('[yjs:observe] mergeRemoteChanges — total:', allShapes.length, 'types:', JSON.stringify(typeBreakdown))
        store.mergeRemoteChanges(() => {
          store.put(allShapes as Parameters<typeof store.put>[0])
        })
        console.log('[yjs:observe] mergeRemoteChanges completed OK')
      } catch (err) {
        console.error('[yjs:observe] ERROR in mergeRemoteChanges — isApplyingRemote reset via finally:', err)
      } finally {
        isApplyingRemote.current = false
        console.log('[yjs:observe] isApplyingRemote reset to false')
      }
    }
    yShapes.observe(observer)
    console.log('[yjs:observe] observer registered on yShapes')
    return () => yShapes.unobserve(observer)
  }, [yShapes, store])

  useEffect(() => {
    console.log('[ws:inbound] registering wsClient listener, ydoc clientID:', ydoc.clientID)
    return wsClient.on((msg) => {
      if (msg.type === 'mutation:broadcast') {
        const bytes = new Uint8Array(msg.payload.yjsUpdate)
        console.log('[ws:inbound] mutation:broadcast —', bytes.length, 'bytes, nodeId:', msg.payload.nodeId, '| yShapes.size before:', yShapes.size)
        try {
          Y.applyUpdate(ydoc, bytes, 'remote')
          console.log('[ws:inbound] applyUpdate OK — yShapes.size after:', yShapes.size)
        } catch (err) {
          console.error('[ws:inbound] applyUpdate threw:', err)
        }
      }
      if (msg.type === 'room:joined') {
        const bytes = new Uint8Array(msg.payload.yjsDiff)
        console.log('[ws:inbound] room:joined — yjsDiff bytes:', bytes.length, '| yShapes.size before:', yShapes.size)
        try {
          Y.applyUpdate(ydoc, bytes, 'remote')
          console.log('[ws:inbound] room:joined applyUpdate OK — yShapes.size after:', yShapes.size)
        } catch (err) {
          console.error('[ws:inbound] room:joined applyUpdate threw:', err)
        }
      }
    })
  }, [ydoc, yShapes])

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
