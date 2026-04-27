import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

interface RoomRow {
  room_id: string
  role: string
  rooms: {
    id: string
    name: string
    created_at: string
    session_started_at: string | null
  }
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [newRoomName, setNewRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchRooms()
  }, [user])

  const fetchRooms = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`${SERVER_URL}/rooms`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const json = await res.json()
    setRooms(json.rooms ?? [])
    setLoading(false)
  }

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoomName.trim()) return
    setCreating(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`${SERVER_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ name: newRoomName.trim() })
    })
    const json = await res.json()
    if (json.room) navigate(`/room/${json.room.id}`)
    setCreating(false)
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">LIGMA</h1>
          <p className="text-xs text-slate-500">Live Interactive Group Meeting Assistant</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{user?.email}</span>
          <button onClick={signOut} className="text-sm text-red-500 hover:text-red-700 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4">Create a Room</h2>
          <form onSubmit={createRoom} className="flex gap-3">
            <input
              type="text"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              placeholder="Room name..."
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <button
              type="submit"
              disabled={creating || !newRoomName.trim()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Your Rooms</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-slate-400">No rooms yet. Create one above.</p>
          ) : (
            <div className="space-y-2">
              {rooms.map(r => (
                <button
                  key={r.room_id}
                  onClick={() => navigate(`/room/${r.room_id}`)}
                  className="block w-full text-left p-3 border rounded hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{r.rooms?.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.role === 'lead' ? 'bg-slate-800 text-white' :
                      r.role === 'contributor' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {r.role}
                    </span>
                  </div>
                  {r.rooms?.created_at && (
                    <div className="text-xs text-slate-400 mt-1">
                      Created {new Date(r.rooms.created_at).toLocaleDateString()}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
