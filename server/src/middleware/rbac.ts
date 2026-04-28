import type { UserRole, AuthSocket, WSClientMessage, MutationApplyMessage, WSServerMessage } from '@shared/types'
import { db } from '../db/supabase.js'
import { writeEvent } from '../services/eventLog.js'

interface NodeAcl {
  room_id: string
  node_id: string
  required_role: UserRole
  is_locked: boolean
  locked_by: string | null
}

export const roleCache = new Map<string, { role: UserRole; expiresAt: number }>()
export const aclCache = new Map<string, { acl: NodeAcl | null; expiresAt: number }>()
const denialLog = new Map<string, number>()

export async function getMembership(userId: string, roomId: string): Promise<UserRole | null> {
  const key = `${userId}:${roomId}`
  const cached = roleCache.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.role
  const { data } = await db.from('room_members').select('role').eq('room_id', roomId).eq('user_id', userId).single()
  if (!data) return null
  roleCache.set(key, { role: data.role as UserRole, expiresAt: Date.now() + 5000 })
  return data.role as UserRole
}

export async function getNodeAcl(roomId: string, nodeId: string): Promise<NodeAcl | null> {
  const key = `${roomId}:${nodeId}`
  const cached = aclCache.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.acl
  const { data } = await db.from('node_acl').select('*').eq('room_id', roomId).eq('node_id', nodeId).single()
  aclCache.set(key, { acl: (data ?? null) as NodeAcl | null, expiresAt: Date.now() + 5000 })
  return (data ?? null) as NodeAcl | null
}

function logPermissionDenied(userId: string, roomId: string, nodeId: string, action: string) {
  const key = `${userId}:${nodeId}`
  if (Date.now() - (denialLog.get(key) ?? 0) < 10_000) return
  denialLog.set(key, Date.now())
  writeEvent(roomId, userId, 'permission_denied', nodeId, { action }).catch(console.error)
}

function send(socket: AuthSocket, msg: WSServerMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
}

export async function checkPermission(socket: AuthSocket, msg: WSClientMessage): Promise<boolean> {
  const payload = (msg as MutationApplyMessage).payload

  if (msg.type !== 'room:join' && socket.roomId && socket.roomId !== payload.roomId) {
    console.log(`[rbac] DENY user=${socket.userId} reason=ROOM_MISMATCH socket.roomId=${socket.roomId} payload.roomId=${payload.roomId}`)
    send(socket, { type: 'error:permission_denied', payload: { code: 'ROOM_MISMATCH' } })
    return false
  }

  const role = await getMembership(socket.userId, payload.roomId)
  console.log(`[rbac] checkPermission user=${socket.userId} role=${role} nodeId=${payload.nodeId}`)

  if (role === null) {
    console.log(`[rbac] DENY user=${socket.userId} reason=NOT_A_MEMBER`)
    send(socket, { type: 'error:permission_denied', payload: { code: 'NOT_A_MEMBER' } })
    return false
  }

  // Viewers can never mutate — short-circuit before any ACL lookup
  if (role === 'viewer') {
    console.log(`[rbac] DENY user=${socket.userId} reason=VIEWER nodeId=${payload.nodeId}`)
    send(socket, { type: 'error:permission_denied', payload: { code: 'INSUFFICIENT_ROLE' } })
    logPermissionDenied(socket.userId, payload.roomId, payload.nodeId, msg.type)
    return false
  }

  const nodeAcl = await getNodeAcl(payload.roomId, payload.nodeId)
  const requiredRole = nodeAcl?.required_role ?? 'contributor'
  const isLocked = nodeAcl?.is_locked ?? false

  console.log(`[rbac] nodeId=${payload.nodeId} acl=${nodeAcl ? `required=${requiredRole} locked=${isLocked}` : 'none(fallback=contributor)'}`)

  const hierarchy: Record<UserRole, number> = { lead: 3, contributor: 2, viewer: 1 }
  if (hierarchy[role] < hierarchy[requiredRole]) {
    console.log(`[rbac] DENY user=${socket.userId} role=${role} < required=${requiredRole}`)
    send(socket, { type: 'error:permission_denied', payload: { code: 'INSUFFICIENT_ROLE' } })
    logPermissionDenied(socket.userId, payload.roomId, payload.nodeId, msg.type)
    return false
  }

  if (isLocked) {
    console.log(`[rbac] DENY user=${socket.userId} nodeId=${payload.nodeId} reason=NODE_LOCKED`)
    send(socket, { type: 'error:permission_denied', payload: { code: 'NODE_LOCKED' } })
    return false
  }

  console.log(`[rbac] ALLOW user=${socket.userId} role=${role} nodeId=${payload.nodeId}`)
  return true
}
