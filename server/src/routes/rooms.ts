import { Router } from 'express'
import { db } from '../db/supabase.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { getMembership, roleCache } from '../middleware/rbac.js'
import { broadcastToRoom } from '../ws/hub.js'

const router = Router()

router.post('/', requireAuth, async (req: any, res: any) => {
  const { name } = req.body
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' })
  const { data: room, error } = await db.from('rooms')
    .insert({ name, created_by: req.userId }).select().single()
  if (error || !room) return res.status(500).json({ error: 'Internal server error' })
  await db.from('room_members').insert({ room_id: room.id, user_id: req.userId, role: 'lead' })
  res.json({ room })
})

router.get('/', requireAuth, async (req: any, res: any) => {
  const { data: memberships } = await db.from('room_members')
    .select('room_id, role, rooms(id, name, created_at, session_started_at)')
    .eq('user_id', req.userId)
  res.json({ rooms: memberships ?? [] })
})

router.get('/:id', requireAuth, async (req: any, res: any) => {
  const role = await getMembership(req.userId, req.params.id)
  if (!role) return res.status(403).json({ error: 'Not a member' })
  const { data: room } = await db.from('rooms').select('*').eq('id', req.params.id).single()
  res.json({ room })
})

router.get('/:id/members', requireAuth, async (req: any, res: any) => {
  const role = await getMembership(req.userId, req.params.id)
  if (!role) return res.status(403).json({ error: 'Not a member' })
  const { data } = await db.from('room_members').select('user_id, role').eq('room_id', req.params.id)
  res.json({ members: data ?? [] })
})

router.post('/:id/members', requireAuth, async (req: any, res: any) => {
  const { id: roomId } = req.params
  const { user_id, role = 'contributor' } = req.body
  const callerRole = await getMembership(req.userId, roomId)
  if (callerRole !== 'lead') return res.status(403).json({ error: 'Lead only' })
  if (!['lead', 'contributor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' })
  const { error } = await db.from('room_members').insert({ room_id: roomId, user_id, role })
  if (error) return res.status(500).json({ error: 'Internal server error' })
  res.json({ ok: true })
})

router.put('/:id/members/:userId/role', requireAuth, async (req: any, res: any) => {
  const { id: roomId, userId: targetUserId } = req.params
  const { role } = req.body
  if (!['lead', 'contributor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }
  const callerRole = await getMembership(req.userId, roomId)
  if (callerRole !== 'lead') return res.status(403).json({ error: 'Lead only' })
  if (role !== 'lead' && targetUserId === req.userId) {
    const { count } = await db.from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId).eq('role', 'lead').neq('user_id', req.userId)
    if (!count) return res.status(400).json({ error: 'Cannot demote last lead' })
  }
  const { error } = await db.from('room_members').update({ role })
    .eq('room_id', roomId).eq('user_id', targetUserId)
  if (error) return res.status(500).json({ error: 'Internal server error' })
  for (const [key] of roleCache.entries()) {
    if (key.startsWith(`${targetUserId}:`)) roleCache.delete(key)
  }
  broadcastToRoom(roomId, { type: 'role:changed', payload: { userId: targetUserId, newRole: role } })
  res.json({ ok: true })
})

export default router
