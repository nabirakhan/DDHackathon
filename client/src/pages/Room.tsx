// client/src/components/NodeLockButton.tsx
import { useEffect, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { useEditor } from '../context/CanvasContext'
import { wsClient } from '../lib/wsClient'
import { useMyRole } from '../hooks/useMyRole'
import { toast } from 'sonner'
import type { TLShapeId } from 'tldraw'

export function NodeLockButton({ roomId }: { roomId: string }) {
  const editor = useEditor()
  const { role } = useMyRole(roomId)
  const [hoveredNode, setHoveredNode] = useState<TLShapeId | null>(null)
  const [lockedNodes, setLockedNodes] = useState<Set<string>>(new Set())
  const [isLocking, setIsLocking] = useState(false)

  // Subscribe to lock/unlock events
  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'node:decision_locked') {
        setLockedNodes(prev => new Set(prev).add(msg.payload.nodeId))
        toast.success('Node locked', {
          description: 'This node can no longer be edited',
        })
      }
      if (msg.type === 'node:unlocked') {
        setLockedNodes(prev => {
          const next = new Set(prev)
          next.delete(msg.payload.nodeId)
          return next
        })
        toast.info('Node unlocked', {
          description: 'This node can now be edited again',
        })
      }
    })
  }, [])

  // Track hovered shape - use pointer move and selection
  useEffect(() => {
    if (!editor) return
    
    // Also listen for shape selection changes
    const handleSelectionChange = () => {
      const selectedShapes = editor.getSelectedShapes()
      if (selectedShapes.length === 1) {
        setHoveredNode(selectedShapes[0].id)
      } else if (selectedShapes.length === 0 && hoveredNode) {
        setHoveredNode(null)
      }
    }
    
    // Handle pointer move for hover without selection
    const handlePointerMove = () => {
      // If we already have a selected shape, don't override
      if (editor.getSelectedShapes().length > 0) return
      
      // Try to get shape under cursor
      const { currentPagePoint } = editor.inputs
      const shapeAtPoint = editor.getShapeAtPoint(currentPagePoint)
      if (shapeAtPoint) {
        setHoveredNode(shapeAtPoint.id)
      } else if (hoveredNode) {
        setHoveredNode(null)
      }
    }
    
    editor.on('selection:change', handleSelectionChange)
    editor.on('pointer:move', handlePointerMove)
    
    return () => {
      editor.off('selection:change', handleSelectionChange)
      editor.off('pointer:move', handlePointerMove)
    }
  }, [editor, hoveredNode])

  // Only show for lead
  if (role !== 'lead') return null

  const isLocked = hoveredNode ? lockedNodes.has(hoveredNode) : false

  const toggleLock = async () => {
    if (!hoveredNode || isLocking) return
    
    setIsLocking(true)
    
    if (isLocked) {
      // Unlock: remove lock from node_acl
      wsClient.send({
        type: 'node:unlock',
        payload: { roomId, nodeId: hoveredNode }
      })
    } else {
      // Lock: set lock in node_acl
      wsClient.send({
        type: 'decision:lock',
        payload: { roomId, nodeId: hoveredNode }
      })
    }
    
    setTimeout(() => setIsLocking(false), 500)
  }

  if (!hoveredNode) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: 'rgba(47, 62, 70, 0.95)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${isLocked ? 'rgba(239, 68, 68, 0.5)' : 'rgba(132, 169, 140, 0.5)'}`,
        borderRadius: '999px',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        pointerEvents: 'auto',
        cursor: isLocking ? 'wait' : 'pointer',
        transition: 'all 0.2s ease',
      }}
      onClick={toggleLock}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateX(-50%) scale(1)'
      }}
    >
      {isLocked ? (
        <>
          <Lock size={16} color="#ef4444" />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>
            Unlock Node
          </span>
        </>
      ) : (
        <>
          <Unlock size={16} color="#84A98C" />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#84A98C' }}>
            Lock Node
          </span>
        </>
      )}
    </div>
  )
}