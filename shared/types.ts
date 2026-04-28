// shared/types.ts
export type UserRole = 'lead' | 'contributor' | 'viewer'
export type IntentType = 'action_item' | 'decision' | 'open_question' | 'reference'

export interface AwarenessState {
  cursor: { x: number; y: number }
  name: string
  color: string
  selection?: string
}

// AuthSocket is server-only — kept in server/src/ws/types.ts to avoid 'ws' import in client build

export type AuthMessage = { type: 'auth'; payload: { token: string } }
export type AuthRefreshMessage = { type: 'auth:refresh'; payload: { token: string } }
export type RoomJoinMessage = {
  type: 'room:join'
  payload: { roomId: string; clientStateVector: number[]; displayName?: string }
}
export type MutationApplyMessage = {
  type: 'mutation:apply'
  payload: {
    roomId: string
    nodeId: string
    yjsUpdate: number[]
    textSnapshot?: string
  }
}
export type AwarenessUpdateMessage = {
  type: 'awareness:update'
  payload: AwarenessState
}
export type VoteCastMessage = {
  type: 'vote:cast'
  payload: { roomId: string; nodeId: string; votedForUserId: string }
}
export type DecisionLockMessage = {
  type: 'decision:lock'
  payload: { roomId: string; nodeId: string }
}
export type NodeLockRequestMessage = {
  type: 'node:lock_request'
  payload: { roomId: string; nodeId: string; required_role: UserRole }
}

export type WSClientMessage =
  | AuthMessage | AuthRefreshMessage | RoomJoinMessage | MutationApplyMessage
  | AwarenessUpdateMessage | VoteCastMessage | DecisionLockMessage | NodeLockRequestMessage

export type RoomJoinedMessage = {
  type: 'room:joined'
  payload: {
    yjsDiff: number[]
    isCompressed?: boolean
    sessionStartedAt: string | null
    decisionCount: number
    awarenessStates: Array<{ userId: string; displayName?: string } & AwarenessState>
  }
}
export type MutationBroadcastMessage = {
  type: 'mutation:broadcast'
  payload: { yjsUpdate: number[]; nodeId: string }
}
export type AwarenessBroadcastMessage = {
  type: 'awareness:broadcast'
  payload: { userId: string } & AwarenessState
}
export type AwarenessPeerLeftMessage = {
  type: 'awareness:peer_left'
  payload: { userId: string }
}
export type RoleChangedMessage = {
  type: 'role:changed'
  payload: { userId: string; newRole: UserRole }
}
export type MemberJoinedMessage = {
  type: 'member:joined'
  payload: { userId: string; role: UserRole; displayName?: string }
}
export type MemberRemovedMessage = {
  type: 'member:removed'
  payload: { userId: string }
}
export type NodeContestedMessage = {
  type: 'node:contested'
  payload: { nodeId: string; versions: Record<string, string> }
}
export type NodeDecisionLockedMessage = {
  type: 'node:decision_locked'
  payload: { nodeId: string }
}
export type VoteUpdatedMessage = {
  type: 'vote:updated'
  payload: { nodeId: string; voterId: string; votedFor: string }
}
export type TaskCreatedMessage = {
  type: 'task:created'
  payload: { task: { id: string; room_id: string; source_node_id: string; text: string; author_id: string; created_at: string; status: string } }
}
export type TaskUpdatedMessage = {
  type: 'task:updated'
  payload: { taskId: string; status: string }
}
export type AuthRefreshedMessage = { type: 'auth:refreshed' }
export type ErrorPermissionDeniedMessage = {
  type: 'error:permission_denied'
  payload: { code: 'NOT_A_MEMBER' | 'INSUFFICIENT_ROLE' | 'NODE_LOCKED' | 'ROOM_MISMATCH' }
}
export type ErrorMalformedUpdateMessage = { type: 'error:malformed_update'; payload: Record<string, never> }
export type ErrorContestResolvedMessage = { type: 'error:contest_resolved'; payload: Record<string, never> }
export type ErrorInternalMessage = { type: 'error:internal'; payload: Record<string, never> }

export type WSServerMessage =
  | RoomJoinedMessage | MutationBroadcastMessage | AwarenessBroadcastMessage | AwarenessPeerLeftMessage
  | RoleChangedMessage | MemberJoinedMessage | MemberRemovedMessage
  | NodeContestedMessage | NodeDecisionLockedMessage | VoteUpdatedMessage
  | TaskCreatedMessage | TaskUpdatedMessage | AuthRefreshedMessage
  | ErrorPermissionDeniedMessage | ErrorMalformedUpdateMessage | ErrorContestResolvedMessage | ErrorInternalMessage
