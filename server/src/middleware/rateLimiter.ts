const buckets = new Map<string, { tokens: number; lastRefill: number }>()

export function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const b = buckets.get(userId) ?? { tokens: 10, lastRefill: now }
  const elapsed = (now - b.lastRefill) / 1000 / 60
  b.tokens = Math.min(10, b.tokens + elapsed * 10)
  b.lastRefill = now
  if (b.tokens < 1) return false
  b.tokens -= 1
  buckets.set(userId, b)
  return true
}
