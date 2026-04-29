// client/src/lib/keepAlive.ts
export function startKeepAlive(serverUrl: string): () => void {
  const id = setInterval(() => fetch(`${serverUrl}/health`).catch(() => {}), 10 * 60 * 1000)
  return () => clearInterval(id)
}
