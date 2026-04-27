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

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}))

app.use(express.json({ limit: '1mb' }))

const allowedOrigins = () => [
  process.env.CLIENT_ORIGIN,
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173'] : [])
]

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins().includes(origin)) return cb(null, true)
    cb(new Error('CORS: origin not allowed'))
  }
}))

app.get('/health', (_req, res) => res.json({ ok: true }))
app.use('/rooms', roomsRouter)
app.use('/rooms', eventsRouter)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

const server = createServer(app)
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin
  if (!origin || !allowedOrigins().includes(origin)) {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
})

attachAuth(wss)

const port = process.env.PORT ?? 3000
server.listen(port, () => console.log(`LIGMA server up on port ${port}`))
