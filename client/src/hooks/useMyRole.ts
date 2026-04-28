import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { wsClient } from '../lib/wsClient'
import { useAuth } from './useAuth'
import type { UserRole } from '@shared/types'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

export function useMyRole(roomId: string) {
  const { user } = useAuth()
  const [role, setRole] = useState<UserRole | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch(`${SERVER_URL}/rooms/${roomId}/members`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(({ members }) => {
          const me = members?.find((m: { user_id: string; role: UserRole }) => m.user_id === user.id)
          if (me) setRole(me.role as UserRole)
        })
        .catch(console.error)
    })
  }, [roomId, user])

  useEffect(() => {
    if (!user) return
    return wsClient.on((msg) => {
      if (msg.type === 'role:changed' && msg.payload.userId === user.id) {
        setRole(msg.payload.newRole)
        console.log(`[role] my role changed to ${msg.payload.newRole}`)
      }
    })
  }, [user])

  return { role, userId: user?.id ?? null }
}
