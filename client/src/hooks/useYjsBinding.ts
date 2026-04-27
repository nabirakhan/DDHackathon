import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import type { TLShapeId } from 'tldraw'
import { useCanvas } from '../context/CanvasContext'
import { wsClient } from '../lib/wsClient'

interface PendingMeta { nodeId: string; textSnapshot?: string }

export function useYjsBinding(roomId: string) {
  const { store, ydoc, yShapes } = useCanvas()
  const isApplyingRemote = useRef(false)
  const metaQueue = useRef<PendingMeta[]>([])

  // tldraw → Yjs (one transact per shape, push meta before each)
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
        const text = ((shape as { props?: { text?: string } })?.props?.text)
        metaQueue.current.push({ nodeId: id, textSnapshot: text })
        ydoc.transact(() => {
          if (kind === 'remove') yShapes.delete(id)
          else yShapes.set(id, shape as Parameters<typeof yShapes.set>[1])
        }, 'local')
      }
    })
  }, [store, ydoc, yShapes])

  // Yjs → tldraw (handle removals explicitly)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const observer = (event: Y.YMapEvent<any>) => {
      if (event.transaction.origin === 'local') return
      isApplyingRemote.current = true
      const removed = Array.from(event.keysChanged).filter(k => !yShapes.has(k)) as TLShapeId[]
      if (removed.length) store.remove(removed)
      store.put(Array.from(yShapes.values()) as Parameters<typeof store.put>[0])
      isApplyingRemote.current = false
    }
    yShapes.observe(observer)
    return () => yShapes.unobserve(observer)
  }, [yShapes, store])

  // Send local updates with shifted metadata
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
