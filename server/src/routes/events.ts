import { Router } from 'express'
import { db } from '../db/supabase.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { getMembership } from '../middleware/rbac.js'

const router = Router()

router.get('/:id/events', requireAuth, async (req: any, res: any) => {
  const role = await getMembership(req.userId, req.params.id)
  if (!role) return res.status(403).json({ error: 'Not a member' })
  const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined
  const limit = Math.min(parseInt((req.query.limit as string) ?? '50'), 100)
  let q = db.from('events').select('*')
    .eq('room_id', req.params.id).order('id', { ascending: false }).limit(limit)
  if (cursor) q = q.lt('id', cursor)
  const { data } = await q
  res.json({ events: data ?? [], nextCursor: data?.length ? data[data.length - 1].id : null })
})

export default router
