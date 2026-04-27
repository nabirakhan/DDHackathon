import { useEffect, useState } from 'react'
import { wsClient } from '../lib/wsClient'

export type Status = 'connected' | 'reconnecting' | 'disconnected'

export function useConnectionStatus(): Status {
  const [status, setStatus] = useState<Status>('disconnected')

  useEffect(() => {
    const tick = () => {
      const rs = wsClient.getReadyState()
      if (rs === WebSocket.OPEN) setStatus('connected')
      else if (rs === WebSocket.CONNECTING) setStatus('reconnecting')
      else setStatus('disconnected')
    }
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [])

  return status
}
