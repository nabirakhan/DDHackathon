import type { Request, Response, NextFunction } from 'express'
import { db } from '../db/supabase.js'

export async function requireAuth(
  req: Request & { userId?: string },
  res: Response,
  next: NextFunction
) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    console.log('[requireAuth] No token provided')
    return res.status(401).json({ error: 'Missing token' })
  }
  
  const token = auth.slice(7)
  const { data: { user }, error } = await db.auth.getUser(token)
  
  if (error || !user) {
    console.log('[requireAuth] Invalid token:', error?.message)
    return res.status(401).json({ error: 'Invalid token' })
  }
  
  req.userId = user.id
  console.log(`[requireAuth] Authenticated user: ${user.id}`)
  next()
}