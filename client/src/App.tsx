// client/src/App.tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from '@/pages/Home'
import Room from '@/pages/Room'
import Login from '@/pages/Login'
import { useAuth } from '@/hooks/useAuth'
import { wsClient } from '@/lib/wsClient'
import { startKeepAlive } from '@/lib/keepAlive'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string
const WS_URL = SERVER_URL?.replace(/^http/, 'ws') ?? 'ws://localhost:3000'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  useEffect(() => {
    wsClient.connect(WS_URL)
    const stop = startKeepAlive(SERVER_URL)
    return stop
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
