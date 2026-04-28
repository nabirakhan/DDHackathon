// client/src/components/ConnectionBanner.tsx
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConnectionStatus } from '../hooks/useConnectionStatus'
import { useEditor } from '../context/CanvasContext'
import { wsClient } from '../lib/wsClient'
import { toast } from 'sonner'
import { WifiOff, RefreshCw } from 'lucide-react'

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

  const isReconnecting = status === 'reconnecting'
  const isDisconnected = status === 'disconnected'

  return (
    <AnimatePresence>
      {(isReconnecting || isDisconnected) && (
        <motion.div
          key="banner"
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={{
            position: 'fixed',
            top: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '999px',
            background: isReconnecting
              ? 'rgba(251, 191, 36, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isReconnecting ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          {isReconnecting
            ? <RefreshCw size={12} style={{ color: '#fbbf24', animation: 'spin 1s linear infinite' }} />
            : <WifiOff size={12} style={{ color: '#ef4444' }} />
          }
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '12px',
            color: isReconnecting ? '#fbbf24' : '#ef4444',
          }}>
            {isReconnecting ? 'Reconnecting...' : 'Connection lost — canvas is read-only'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
