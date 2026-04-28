// client/src/pages/Room.tsx
import { useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { CanvasProvider } from '../context/CanvasContext'
import { useYjsBinding } from '../hooks/useYjsBinding'
import { ConnectionBanner } from '../components/ConnectionBanner'
import { CursorPresence } from '../components/CursorPresence'
import { TaskBoard } from '../components/TaskBoard'
import { EventLog } from '../components/EventLog'
import { TopBar } from '../components/TopBar'
import { ContestedNodeOverlay } from '../components/ContestedNodeOverlay'
import { ToolDock, AIStatusPill } from '../components/ToolDock'
import { wsClient } from '../lib/wsClient'
import { SoftAurora } from '../components/ui/SoftAurora'

function RoomInner({ roomId }: { roomId: string }) {
  useYjsBinding(roomId)

  useEffect(() => {
    wsClient.send({ type: 'room:join', payload: { roomId, clientStateVector: [] } })
  }, [roomId])

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: '#111315', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.65 }}>
        <SoftAurora color1="#5D5646" color2="#3E5974" speed={0.14} brightness={0.3} bandSpread={0.35} enableMouseInteraction={false} />
      </div>

      <TopBar roomId={roomId} />
      <ConnectionBanner />
      <EventLog roomId={roomId} />
      <TaskBoard roomId={roomId} />
      <ContestedNodeOverlay roomId={roomId} />
      <CursorPresence roomId={roomId} />
      <AIStatusPill />
      <ToolDock roomId={roomId} />

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(26, 28, 30, 0.92)',
            border: '1px solid rgba(200, 188, 168, 0.15)',
            color: '#E8E0D0',
            fontFamily: 'DM Mono, monospace',
            fontSize: '12px',
            backdropFilter: 'blur(12px)',
          }
        }}
      />
    </>
  )
}

export default function Room() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return (
    <CanvasProvider>
      <RoomInner roomId={id} />
    </CanvasProvider>
  )
}
