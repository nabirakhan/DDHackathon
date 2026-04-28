// client/src/pages/Home.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { SoftAurora } from '../components/ui/SoftAurora'
import { LogOut, Plus, ArrowRight, Clock } from 'lucide-react'

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

const roleStyle: Record<string, { bg: string; color: string; label: string }> = {
  lead: { bg: 'rgba(62, 89, 116, 0.3)', color: '#5B7A9E', label: 'Lead' },
  contributor: { bg: 'rgba(184, 134, 11, 0.2)', color: '#D4A017', label: 'Contributor' },
  viewer: { bg: 'rgba(139, 134, 128, 0.2)', color: '#8B8680', label: 'Viewer' },
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [newRoomName, setNewRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchRooms()
  }, [user])

  const fetchRooms = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`${SERVER_URL}/rooms`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const json = await res.json()
      setRooms(json.rooms ?? [])
    } catch (err) {
      console.error('[home] fetchRooms failed:', err)
    } finally {
      setLoading(false)
    }
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
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#1A1C1E' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <SoftAurora color1="#5D5646" color2="#3E5974" speed={0.18} brightness={0.4} bandSpread={0.38} enableMouseInteraction={false} />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(26, 28, 30, 0.62)' }} />

      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(200, 188, 168, 0.1)',
        background: 'rgba(26, 24, 20, 0.5)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 800, color: '#E8E0D0', letterSpacing: '-0.5px' }}>
          LIGMA
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#8B8680' }}>
            {user?.email}
          </span>
          <button
            onClick={signOut}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '999px',
              color: '#ef4444',
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      </div>

      <div style={{
        position: 'relative',
        zIndex: 2,
        maxWidth: '680px',
        margin: '0 auto',
        padding: '40px 24px',
        height: 'calc(100vh - 65px)',
        overflowY: 'auto',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: 'rgba(28, 24, 20, 0.65)',
            backdropFilter: 'contrast(110%) blur(20px)',
            border: '1px solid rgba(200, 188, 168, 0.15)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: createOpen ? '20px' : '0' }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700, color: '#E8E0D0' }}>
                New Session
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#8B8680', marginTop: '2px' }}>
                Create a collaborative whiteboard room
              </div>
            </div>
            <button
              onClick={() => setCreateOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #5D5646, #3E5974)',
                border: '1px solid rgba(200, 188, 168, 0.2)',
                borderRadius: '999px',
                color: '#E8E0D0',
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              {createOpen ? 'Cancel' : 'Create'}
            </button>
          </div>

          {createOpen && (
            <motion.form
              onSubmit={createRoom}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{ display: 'flex', gap: '10px' }}
            >
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="Room name..."
                autoFocus
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(200, 188, 168, 0.15)',
                  borderRadius: '8px',
                  color: '#E8E0D0',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={creating || !newRoomName.trim()}
                style={{
                  padding: '10px 20px',
                  background: creating ? 'rgba(93, 86, 70, 0.4)' : 'rgba(93, 86, 70, 0.7)',
                  border: '1px solid rgba(200, 188, 168, 0.2)',
                  borderRadius: '8px',
                  color: '#E8E0D0',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {creating ? 'Creating...' : 'Launch →'}
              </button>
            </motion.form>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: 'rgba(28, 24, 20, 0.65)',
            backdropFilter: 'contrast(110%) blur(20px)',
            border: '1px solid rgba(200, 188, 168, 0.15)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(200, 188, 168, 0.08)',
          }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700, color: '#E8E0D0' }}>
              Your Rooms
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#8B8680' }}>
                Loading...
              </div>
            </div>
          ) : rooms.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#8B8680' }}>
                No rooms yet. Create one above.
              </div>
            </div>
          ) : (
            <div>
              {rooms.map((r, i) => {
                const rs = roleStyle[r.role] ?? roleStyle.viewer
                return (
                  <motion.button
                    key={r.room_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 + 0.15 }}
                    onClick={() => navigate(`/room/${r.room_id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      padding: '16px 24px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: i < rooms.length - 1 ? '1px solid rgba(200, 188, 168, 0.06)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 500, color: '#E8E0D0', marginBottom: '4px' }}>
                        {r.rooms?.name}
                      </div>
                      {r.rooms?.created_at && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#8B8680' }}>
                          <Clock size={10} />
                          {new Date(r.rooms.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: rs.bg,
                        color: rs.color,
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '11px',
                        border: `1px solid ${rs.color}33`,
                      }}>
                        {rs.label}
                      </span>
                      <ArrowRight size={14} style={{ color: '#8B8680' }} />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
