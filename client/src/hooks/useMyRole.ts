import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { wsClient } from '../lib/wsClient'
import { useAuth } from './useAuth'
import type { UserRole } from '@shared/types'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

export function useMyRole(roomId: string) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchRole = useCallback(async () => {
    if (!userId || !roomId) return
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      
      const res = await fetch(`${SERVER_URL}/rooms/${roomId}/members`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const { members } = await res.json()
      const me = members?.find((m: { user_id: string; role: UserRole }) => m.user_id === userId)
      
      if (me) {
        setRole(me.role as UserRole)
        console.log(`[useMyRole] Role fetched: ${me.role}`)
      } else {
        setRole('viewer')
        console.log(`[useMyRole] No role found, defaulting to viewer`)
      }
    } catch (err) {
      console.error('[useMyRole] Error fetching role:', err)
      setRole('viewer')
    } finally {
      setLoading(false)
    }
  }, [userId, roomId])

  useEffect(() => {
    fetchRole()
  }, [fetchRole])

  useEffect(() => {
    if (!userId) return
    
    const unsubscribe = wsClient.on((msg) => {
      if (msg.type === 'role:changed' && msg.payload.userId === userId) {
        setRole(msg.payload.newRole)
        console.log(`[useMyRole] Role changed via WebSocket to: ${msg.payload.newRole}`)
      }
      
      if (msg.type === 'member:joined' && msg.payload.userId === userId) {
        fetchRole()
      }
    })
    
    return unsubscribe
  }, [userId, fetchRole])

  return { role, userId, loading, isViewer: role === 'viewer', isContributor: role === 'contributor', isLead: role === 'lead' }
}