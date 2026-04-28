// client/src/components/NodeLockButton.tsx
import { useEffect, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { useEditor } from '../context/CanvasContext'
import { wsClient } from '../lib/wsClient'
import { useMyRole } from '../hooks/useMyRole'
import type { TLShapeId } from 'tldraw'

export function NodeLockButton({ roomId }: { roomId: string }) {
  const editor = useEditor()
  const { role } = useMyRole(roomId)
  const [selectedNode, setSelectedNode] = useState<TLShapeId | null>(null)
  const [lockedNodes, setLockedNodes] = useState<Set<string>>(new Set())

  // Subscribe to lock/unlock events
  useEffect(() => {
    const unsubscribe = wsClient.on((msg) => {
      if (msg.type === 'node:decision_locked') {
        setLockedNodes(prev => new Set(prev).add(msg.payload.nodeId))
      }
      if (msg.type === 'node:unlocked') {
        setLockedNodes(prev => {
          const next = new Set(prev)
          next.delete(msg.payload.nodeId)
          return next
        })
      }
    })
    return unsubscribe
  }, [])

  // Track selected shape using tldraw's store events
  useEffect(() => {
    if (!editor) return
    
    // Subscribe to selection changes via store
    const unsubscribe = editor.store.listen(
      (event) => {
        // Check if selection changed
        if (event.changes.updated) {
          for (const [_, record] of Object.entries(event.changes.updated)) {
            if (record && (record as any).typeName === 'instance') {
              const selectedIds = editor.getSelectedShapeIds()
              if (selectedIds && selectedIds.length > 0) {
                setSelectedNode(selectedIds[0])
              } else {
                setSelectedNode(null)
              }
              break
            }
          }
        }
      },
      { source: 'user', scope: 'document' }
    )
    
    return () => {
      unsubscribe()
    }
  }, [editor])

  // Only show for lead
  if (role !== 'lead') return null

  const isLocked = selectedNode ? lockedNodes.has(selectedNode) : false

  const toggleLock = () => {
    if (!selectedNode) return
    
    if (isLocked) {
      wsClient.send({
        type: 'node:unlock',
        payload: { roomId, nodeId: selectedNode }
      })
    } else {
      wsClient.send({
        type: 'decision:lock',
        payload: { roomId, nodeId: selectedNode }
      })
    }
  }

  if (!selectedNode) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: 'rgba(47, 62, 70, 0.95)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${isLocked ? 'rgba(239, 68, 68, 0.4)' : 'rgba(132, 169, 140, 0.4)'}`,
        borderRadius: '999px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
      onClick={toggleLock}
    >
      {isLocked ? (
        <>
          <Lock size={14} color="#ef4444" />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#ef4444' }}>
            Unlock Node
          </span>
        </>
      ) : (
        <>
          <Unlock size={14} color="#84A98C" />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#84A98C' }}>
            Lock Node
          </span>
        </>
      )}
    </div>
  )
}