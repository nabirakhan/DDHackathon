import type { Request, Response, NextFunction } from 'express'
import { db } from '../db/supabase.js'

export async function requireAuth(
  req: Request & { userId?: string },
  res: Response,
  next: NextFunction
) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' })
  const { data: { user } } = await db.auth.getUser(auth.slice(7))
  if (!user) return res.status(401).json({ error: 'Invalid token' })
  req.userId = user.id
  next()
}
