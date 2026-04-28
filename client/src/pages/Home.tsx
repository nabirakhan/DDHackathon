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
  rooms: { id: string; name: string; created_at: string; session_started_at: string | null }
}

const roleStyle: Record<string, { bg: string; color: string; label: string }> = {
  lead:        { bg: 'rgba(82,121,111,0.25)', color: '#84A98C', label: 'Lead' },
  contributor: { bg: 'rgba(53,79,82,0.35)',   color: '#52796F', label: 'Contributor' },
  viewer:      { bg: 'rgba(202,210,197,0.08)', color: 'rgba(202,210,197,0.4)', label: 'Viewer' },
}

const panel: React.CSSProperties = {
  background: 'rgba(47, 62, 70, 0.68)',
  backdropFilter: 'blur(40px) saturate(150%)',
  WebkitBackdropFilter: 'blur(40px) saturate(150%)',
  border: '1px solid rgba(202, 210, 197, 0.09)',
  borderRadius: '1.5rem',
  boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [newRoomName, setNewRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => { if (!user) return; fetchRooms() }, [user])

  const fetchRooms = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`${SERVER_URL}/rooms`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: newRoomName.trim() })
    })
    const json = await res.json()
    if (json.room) navigate(`/room/${json.room.id}`)
    setCreating(false)
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#141f1f' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <SoftAurora color1="#354F52" color2="#52796F" speed={0.16} brightness={0.38} bandSpread={0.38} enableMouseInteraction={false} />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(20,31,31,0.55)' }} />

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid rgba(202,210,197,0.07)', background: 'rgba(47,62,70,0.5)', backdropFilter: 'blur(20px)' }}>
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, color: '#CAD2C5', letterSpacing: '-0.5px' }}>LIGMA</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(202,210,197,0.4)' }}>{user?.email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '999px', color: '#ef4444', fontFamily: 'Inter, sans-serif', fontSize: '12px', cursor: 'pointer' }}>
            <LogOut size={11} /> Sign out
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: '640px', margin: '0 auto', padding: '36px 24px', height: 'calc(100vh - 61px)', overflowY: 'auto' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ ...panel, padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: createOpen ? '16px' : 0 }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: '#CAD2C5' }}>New Session</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(202,210,197,0.4)', marginTop: '2px' }}>Create a collaborative workspace</div>
            </div>
            <button onClick={() => setCreateOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: 'linear-gradient(135deg, #52796F, #354F52)', border: '1px solid rgba(132,169,140,0.25)', borderRadius: '999px', color: '#CAD2C5', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={13} /> {createOpen ? 'Cancel' : 'Create'}
            </button>
          </div>
          {createOpen && (
            <motion.form onSubmit={createRoom} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ display: 'flex', gap: '10px' }}>
              <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="Session name..." autoFocus style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(202,210,197,0.12)', borderRadius: '10px', color: '#CAD2C5', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none' }} />
              <button type="submit" disabled={creating || !newRoomName.trim()} style={{ padding: '10px 20px', background: creating ? 'rgba(82,121,111,0.3)' : 'rgba(82,121,111,0.6)', border: '1px solid rgba(132,169,140,0.2)', borderRadius: '10px', color: '#CAD2C5', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {creating ? 'Creating...' : 'Launch →'}
              </button>
            </motion.form>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }} style={{ ...panel, overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid rgba(202,210,197,0.06)' }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: '#CAD2C5' }}>Your Rooms</span>
          </div>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(202,210,197,0.3)' }}>Loading...</div>
          ) : rooms.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(202,210,197,0.3)' }}>No rooms yet. Create one above.</div>
          ) : (
            <div>
              {rooms.map((r, i) => {
                const rs = roleStyle[r.role] ?? roleStyle.viewer
                return (
                  <motion.button key={r.room_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 + 0.1 }}
                    onClick={() => navigate(`/room/${r.room_id}`)}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '14px 24px', background: 'transparent', border: 'none', borderBottom: i < rooms.length - 1 ? '1px solid rgba(202,210,197,0.05)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                    whileHover={{ backgroundColor: 'rgba(82,121,111,0.12)' }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500, color: '#CAD2C5', marginBottom: '3px' }}>{r.rooms?.name}</div>
                      {r.rooms?.created_at && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(202,210,197,0.3)' }}>
                          <Clock size={9} /> {new Date(r.rooms.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ padding: '2px 9px', borderRadius: '999px', background: rs.bg, color: rs.color, fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600 }}>{rs.label}</span>
                      <ArrowRight size={13} style={{ color: 'rgba(202,210,197,0.25)' }} />
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
