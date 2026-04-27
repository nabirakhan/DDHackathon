import { useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { CanvasProvider } from '../context/CanvasContext'
import { useYjsBinding } from '../hooks/useYjsBinding'
import { ConnectionBanner } from '../components/ConnectionBanner'
import { CursorPresence } from '../components/CursorPresence'
import { TaskBoard } from '../components/TaskBoard'
import { EventLog } from '../components/EventLog'
import { SessionHealthBar } from '../components/SessionHealthBar'
import { ContestedNodeOverlay } from '../components/ContestedNodeOverlay'
import { wsClient } from '../lib/wsClient'

function RoomInner({ roomId }: { roomId: string }) {
  useYjsBinding(roomId)

  useEffect(() => {
    wsClient.send({
      type: 'room:join',
      payload: { roomId, clientStateVector: [] }
    })
  }, [roomId])

  return (
    <div className="flex flex-col h-screen">
      <ConnectionBanner />
      <SessionHealthBar />
      <div className="flex flex-1 overflow-hidden">
        <EventLog roomId={roomId} />
        <div className="flex-1 relative">
          <CursorPresence roomId={roomId} />
          <ContestedNodeOverlay roomId={roomId} />
        </div>
        <TaskBoard roomId={roomId} />
      </div>
      <Toaster position="bottom-center" />
    </div>
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
