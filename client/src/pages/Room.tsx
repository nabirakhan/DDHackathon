// client/src/pages/Room.tsx
import { useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { CanvasProvider, CanvasMount, useEditor } from '../context/CanvasContext'
import { useYjsBinding } from '../hooks/useYjsBinding'
import { useMyRole } from '../hooks/useMyRole'
import { ConnectionBanner } from '../components/ConnectionBanner'
import { CursorPresence } from '../components/CursorPresence'
import { TaskBoard } from '../components/TaskBoard'
import { EventLog } from '../components/EventLog'
import { TopBar } from '../components/TopBar'
import { ContestedNodeOverlay } from '../components/ContestedNodeOverlay'
import { ToolDock, AIStatusPill } from '../components/ToolDock'
import { NodeLockButton } from '../components/NodeLockButton'
import { wsClient } from '../lib/wsClient'
import { SoftAurora } from '../components/ui/SoftAurora'
import { getDisplayName } from '../hooks/useAuth'

function RoomInner({ roomId }: { roomId: string }) {
  useYjsBinding(roomId)
  const editor = useEditor()
  const { role } = useMyRole(roomId)

  useEffect(() => {
    wsClient.send({ type: 'room:join', payload: { roomId, clientStateVector: [], displayName: getDisplayName() } })
  }, [roomId])

  useEffect(() => {
    if (!editor || !role) return
    const isReadOnly = role === 'viewer'
    editor.updateInstanceState({ isReadonly: isReadOnly })
  }, [editor, role])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#141f1f' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <SoftAurora
          color1="#354F52"
          color2="#52796F"
          speed={0.14}
          brightness={0.38}
          bandSpread={0.4}
          enableMouseInteraction={false}
        />
      </div>

      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '20px',
        gap: '16px',
      }}>
        <TopBar roomId={roomId} />

        <div style={{ display: 'flex', flex: 1, gap: '16px', minHeight: 0 }}>
          <EventLog roomId={roomId} />

          <main style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '2.5rem',
            background: '#F0F4F2',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.12), 0 40px 100px rgba(0,0,0,0.5)',
          }}>
            <CanvasMount />
          </main>

          <TaskBoard roomId={roomId} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <ToolDock roomId={roomId} />
        </div>
      </div>

      <ConnectionBanner />
      <ContestedNodeOverlay roomId={roomId} />
      <CursorPresence roomId={roomId} />
      <AIStatusPill />
      <NodeLockButton roomId={roomId} />

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(47, 62, 70, 0.92)',
            border: '1px solid rgba(202, 210, 197, 0.15)',
            color: '#CAD2C5',
            fontFamily: 'Inter, sans-serif',
            fontSize: '12px',
            backdropFilter: 'blur(20px)',
          }
        }}
      />
    </div>
  )
}

// DEFAULT EXPORT - THIS IS IMPORTANT
export default function Room() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return (
    <CanvasProvider>
      <RoomInner roomId={id} />
    </CanvasProvider>
  )
}
