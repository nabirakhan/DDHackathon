import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import roomsRouter from './routes/rooms.js'
import eventsRouter from './routes/events.js'
import { attachAuth } from './middleware/auth.js'

const app = express()

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server kept alive):', err)
})
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection (server kept alive):', err)
})

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

// Rate limiting - less aggressive for production
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 1000 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
}))

app.use(express.json({ limit: '1mb' }))

app.use(cors({ origin: true, credentials: true }))

// Pre-flight requests
app.options('*', cors())

app.get('/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }))
app.use('/rooms', roomsRouter)
app.use('/rooms', eventsRouter)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

const server = createServer(app)
const wss = new WebSocketServer({ noServer: true })

// WebSocket upgrade — origin check skipped; JWT auth in attachAuth() is the security gate
server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin
  console.log(`[WebSocket] ✅ Accepting connection from: ${origin || 'unknown'}`)
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
})

attachAuth(wss)

const port = process.env.PORT ?? 3000
server.listen(port, () => {
  console.log(`🚀 LIGMA server up on port ${port}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 Client origin: ${process.env.CLIENT_ORIGIN || 'not set'}`)
})