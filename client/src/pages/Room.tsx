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

function RoomInner({ roomId }: { roomId: string }) {
  useYjsBinding(roomId)

  useEffect(() => {
    const sv: number[] = []
    console.log('[room:join] sending room:join — roomId:', roomId, 'clientStateVector:', sv, '| wsState:', wsClient.getReadyState())
    wsClient.send({
      type: 'room:join',
      payload: { roomId, clientStateVector: sv }
    })
  }, [roomId])

  return (
    <>
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
            background: 'rgba(28, 24, 20, 0.9)',
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
