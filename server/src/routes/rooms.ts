import { Router } from 'express'
import { db } from '../db/supabase.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { getMembership, roleCache } from '../middleware/rbac.js'
import { broadcastToRoom } from '../ws/hub.js'
import { rooms } from '../ws/yjsHandler.js'

const router = Router()

router.post('/', requireAuth, async (req: any, res: any) => {
  const { name } = req.body
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' })
  
  const { data: room, error } = await db.from('rooms')
    .insert({ name, created_by: req.userId }).select().single()
  if (error || !room) {
    console.error('Room insert error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
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

// FIXED: Members endpoint - added debug logging and proper error handling
router.get('/:id/members', requireAuth, async (req: any, res: any) => {
  const { id: roomId } = req.params
  const userId = req.userId
  
  console.log(`[members] Request: userId=${userId}, roomId=${roomId}`)
  
  // Verify membership first
  const role = await getMembership(userId, roomId)
  console.log(`[members] Membership check result: role=${role}`)
  
  if (!role) {
    console.log(`[members] Access denied: user ${userId} is not a member of room ${roomId}`)
    return res.status(403).json({ error: 'Not a member' })
  }
  
  // Fetch all members
  const { data: dbMembers, error } = await db.from('room_members')
    .select('user_id, role')
    .eq('room_id', roomId)
  
  if (error) {
    console.error('[members] DB error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
  
  console.log(`[members] Found ${dbMembers?.length || 0} members in DB`)

  // Enrich with display names from connected WebSocket clients
  const nameMap = new Map<string, string>()
  const liveRoom = rooms.get(roomId)
  if (liveRoom) {
    for (const socket of liveRoom.clients) {
      if (socket.userId && socket.displayName) {
        nameMap.set(socket.userId, socket.displayName)
      }
    }
  }

  const members = (dbMembers ?? []).map(m => ({
    user_id: m.user_id,
    role: m.role,
    display_name: nameMap.get(m.user_id) ?? null,
  }))

  res.json({ members })
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

router.delete('/:id/members/:userId', requireAuth, async (req: any, res: any) => {
  const { id: roomId, userId: targetUserId } = req.params
  const callerRole = await getMembership(req.userId, roomId)
  if (callerRole !== 'lead') return res.status(403).json({ error: 'Lead only' })
  if (targetUserId === req.userId) return res.status(400).json({ error: 'Cannot remove yourself' })
  const { error } = await db.from('room_members').delete()
    .eq('room_id', roomId).eq('user_id', targetUserId)
  if (error) return res.status(500).json({ error: 'Internal server error' })
  roleCache.delete(`${targetUserId}:${roomId}`)
  broadcastToRoom(roomId, { type: 'member:removed', payload: { userId: targetUserId } })
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
  console.log(`[role] ${targetUserId} → ${role} in room ${roomId} by ${req.userId}`)
  broadcastToRoom(roomId, { type: 'role:changed', payload: { userId: targetUserId, newRole: role } })
  res.json({ ok: true })
})

router.get('/:id/tasks', requireAuth, async (req: any, res: any) => {
  const role = await getMembership(req.userId, req.params.id)
  if (!role) return res.status(403).json({ error: 'Not a member' })
  const { data } = await db.from('tasks')
    .select('*').eq('room_id', req.params.id).order('created_at', { ascending: false })
  res.json({ tasks: data ?? [] })
})

router.patch('/:id/tasks/:taskId', requireAuth, async (req: any, res: any) => {
  const { id: roomId, taskId } = req.params
  const { status } = req.body
  if (!['open', 'done'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
  const role = await getMembership(req.userId, roomId)
  if (!role) return res.status(403).json({ error: 'Not a member' })
  const { error } = await db.from('tasks').update({ status }).eq('id', taskId).eq('room_id', roomId)
  if (error) return res.status(500).json({ error: 'Internal server error' })
  broadcastToRoom(roomId, { type: 'task:updated', payload: { taskId, status } })
  res.json({ ok: true })
})

router.get('/:id/locked-nodes', requireAuth, async (req: any, res: any) => {
  const role = await getMembership(req.userId, req.params.id)
  if (!role) return res.status(403).json({ error: 'Not a member' })
  const { data } = await db.from('node_acl')
    .select('node_id').eq('room_id', req.params.id).eq('is_locked', true)
  res.json({ lockedNodes: (data ?? []).map((r: any) => r.node_id) })
})

router.get('/:id/tags', requireAuth, async (req: any, res: any) => {
  const { id: roomId } = req.params
  const role = await getMembership(req.userId, roomId)
  if (!role) return res.status(403).json({ error: 'Not a member' })
  const { data, error } = await db.from('node_tags')
    .select('node_id, tag').eq('room_id', roomId)
  if (error) return res.status(500).json({ error: 'Internal server error' })
  const tags: Record<string, string[]> = {}
  for (const row of (data ?? [])) {
    if (!tags[row.node_id]) tags[row.node_id] = []
    tags[row.node_id].push(row.tag)
  }
  res.json({ tags })
})

router.post('/:id/nodes/:nodeId/tags', requireAuth, async (req: any, res: any) => {
  const { id: roomId, nodeId } = req.params
  const { tag } = req.body
  if (!tag || typeof tag !== 'string' || tag.trim().length === 0 || tag.trim().length > 20) {
    return res.status(400).json({ error: 'Invalid tag' })
  }
  const role = await getMembership(req.userId, roomId)
  if (!role) return res.status(403).json({ error: 'Not a member' })
  const cleanTag = tag.trim().toLowerCase()
  // Broadcast first so real-time works even if DB is slow
  broadcastToRoom(roomId, { type: 'tag:added', payload: { nodeId, tag: cleanTag } })
  const { error } = await db.from('node_tags')
    .upsert({ room_id: roomId, node_id: nodeId, tag: cleanTag, created_by: req.userId },
      { onConflict: 'room_id,node_id,tag' })
  if (error) { console.error('[tags] insert error (table may not exist — run schema.sql):', error.message); return res.status(500).json({ error: 'Internal server error' }) }
  res.json({ ok: true })
})

router.delete('/:id/nodes/:nodeId/tags/:tag', requireAuth, async (req: any, res: any) => {
  const { id: roomId, nodeId, tag } = req.params
  const role = await getMembership(req.userId, roomId)
  if (!role) return res.status(403).json({ error: 'Not a member' })
  broadcastToRoom(roomId, { type: 'tag:removed', payload: { nodeId, tag } })
  const { error } = await db.from('node_tags')
    .delete().eq('room_id', roomId).eq('node_id', nodeId).eq('tag', tag)
  if (error) console.error('[tags] delete error:', error.message)
  res.json({ ok: true })
})

export default router