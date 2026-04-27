import { useEffect } from 'react'
import { useConnectionStatus } from '../hooks/useConnectionStatus'
import { useEditor } from '../context/CanvasContext'
import { wsClient } from '../lib/wsClient'
import { toast } from 'sonner'

export function ConnectionBanner() {
  const status = useConnectionStatus()
  const editor = useEditor()

  useEffect(() => {
    if (!editor) return
    editor.updateInstanceState({ isReadonly: status !== 'connected' })
  }, [status, editor])

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'error:permission_denied' && msg.payload.code === 'ROOM_MISMATCH') {
        toast.error('Session out of sync, reloading...')
        setTimeout(() => window.location.reload(), 1000)
        return
      }
      if (msg.type === 'error:permission_denied') {
        toast.error(`Permission denied: ${msg.payload.code}`)
      }
      if (msg.type === 'error:malformed_update') {
        toast.error('Sync error — resyncing...')
        setTimeout(() => window.location.reload(), 500)
      }
    })
  }, [])

  if (status === 'connected') return null
  return (
    <div className={`fixed top-0 left-0 right-0 p-2 text-center text-white z-50 ${
      status === 'reconnecting' ? 'bg-amber-500' : 'bg-red-600'
    }`}>
      {status === 'reconnecting' ? 'Reconnecting...' : 'Connection lost. Canvas is read-only.'}
    </div>
  )
}
