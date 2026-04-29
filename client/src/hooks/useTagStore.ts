import { useCallback, useEffect, useRef, useState } from 'react'
import { wsClient } from '../lib/wsClient'
import { supabase } from '../lib/supabase'

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string

export function useTagStore(roomId: string) {
  const [tags, setTags] = useState<Map<string, string[]>>(new Map())
  const pendingOps = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) return
      fetch(`${SERVER_URL}/rooms/${roomId}/tags`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(json => {
          if (cancelled) return
          const map = new Map<string, string[]>()
          for (const [nodeId, tagList] of Object.entries(json.tags ?? {})) {
            map.set(nodeId, tagList as string[])
          }
          setTags(map)
        })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [roomId])

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'tag:added') {
        const { nodeId, tag } = msg.payload
        setTags(prev => {
          const next = new Map(prev)
          const existing = next.get(nodeId) ?? []
          if (!existing.includes(tag)) next.set(nodeId, [...existing, tag])
          return next
        })
      }
      if (msg.type === 'tag:removed') {
        const { nodeId, tag } = msg.payload
        setTags(prev => {
          const next = new Map(prev)
          const existing = next.get(nodeId) ?? []
          next.set(nodeId, existing.filter(t => t !== tag))
          return next
        })
      }
    })
  }, [])

  const addTag = useCallback(async (nodeId: string, tag: string) => {
    const cleanTag = tag.trim().toLowerCase()
    if (!cleanTag || cleanTag.length > 20) return
    const opKey = `add:${nodeId}:${cleanTag}`
    if (pendingOps.current.has(opKey)) return
    // Optimistic update
    setTags(prev => {
      const next = new Map(prev)
      const existing = next.get(nodeId) ?? []
      if (existing.includes(cleanTag)) return prev
      next.set(nodeId, [...existing, cleanTag])
      return next
    })
    pendingOps.current.add(opKey)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch(`${SERVER_URL}/rooms/${roomId}/nodes/${nodeId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tag: cleanTag }),
      })
    } catch {
      // Rollback
      setTags(prev => {
        const next = new Map(prev)
        next.set(nodeId, (next.get(nodeId) ?? []).filter(t => t !== cleanTag))
        return next
      })
    } finally {
      pendingOps.current.delete(opKey)
    }
  }, [roomId])

  const removeTag = useCallback(async (nodeId: string, tag: string) => {
    const opKey = `remove:${nodeId}:${tag}`
    if (pendingOps.current.has(opKey)) return
    // Optimistic update
    setTags(prev => {
      const next = new Map(prev)
      next.set(nodeId, (next.get(nodeId) ?? []).filter(t => t !== tag))
      return next
    })
    pendingOps.current.add(opKey)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch(`${SERVER_URL}/rooms/${roomId}/nodes/${nodeId}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } catch {
      // Rollback: re-add the tag
      setTags(prev => {
        const next = new Map(prev)
        const existing = next.get(nodeId) ?? []
        if (!existing.includes(tag)) next.set(nodeId, [...existing, tag])
        return next
      })
    } finally {
      pendingOps.current.delete(opKey)
    }
  }, [roomId])

  return { tags, addTag, removeTag }
}
