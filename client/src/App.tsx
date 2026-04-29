// client/src/App.tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from '@/pages/Home'
import Room from '@/pages/Room'
import Login from '@/pages/Login'
import { useAuth } from '@/hooks/useAuth'
import { wsClient } from '@/lib/wsClient'
import { startKeepAlive } from '@/lib/keepAlive'

// Fix: Proper URL construction
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://ddhackathon.onrender.com'
const WS_URL = import.meta.env.VITE_WS_URL || SERVER_URL.replace(/^https?/, 'wss')

console.log('[App] Server URL:', SERVER_URL)
console.log('[App] WebSocket URL:', WS_URL)

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  useEffect(() => {
    // Connect WebSocket
    wsClient.connect(WS_URL)
    
    // Start keep-alive pings
    const stopKeepAlive = startKeepAlive(SERVER_URL)
    
    return () => {
      stopKeepAlive()
      wsClient.disconnect()
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGate><Home /></AuthGate>} />
        <Route path="/room/:id" element={<AuthGate><Room /></AuthGate>} />
      </Routes>
    </BrowserRouter>
  )
}