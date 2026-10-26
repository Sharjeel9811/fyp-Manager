import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import http from 'http'

dotenv.config()

import authRoutes from './routes/authRoutes'
import studentRoutes from './routes/studentRoutes'
import supervisorRoutes from './routes/supervisorRoutes'
import adminRoutes from './routes/adminRoutes'
import notificationRoutes from './routes/notificationRoutes'
import healthRoutes from './routes/healthRoutes'
import realtimeRoutes from './routes/realtimeRoutes'
import defenseRoutes from './routes/defenseRoutes'
import githubRoutes from './routes/githubRoutes'
import mockDefenseRoutes from './routes/mockDefenseRoutes'
import kanbanRoutes from './routes/kanbanRoutes'
import { errorHandler } from './middleware/errorHandler'
import { sanitizeInput } from './middleware/sanitize'
import { connectDB } from './config/database'
import { initRealtime, allowedOrigins } from './services/realtime'

const app = express()
const PORT = Number(process.env.PORT || 5000)
const server = http.createServer(app)

// Behind Vercel's proxy the client IP arrives in X-Forwarded-For.
app.set('trust proxy', 1)

app.use(helmet())
app.use(
  cors({
    // Same origin list as the Socket.IO handshake so REST and websockets can
    // never disagree about which frontend is allowed.
    origin: allowedOrigins(),
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(sanitizeInput)

app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

app.get('/', (_req, res) => res.json({ service: 'FYP Manager API', version: '1.0.0' }))
app.use('/health', healthRoutes)
app.use('/api/v1/health', healthRoutes)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/student', studentRoutes)
app.use('/api/v1/supervisor', supervisorRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/realtime', realtimeRoutes)
app.use('/api/v1/defense', defenseRoutes)
app.use('/api/v1/github', githubRoutes)
app.use('/api/v1/mockdefense', mockDefenseRoutes)
app.use('/api/v1/kanban', kanbanRoutes)

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }))
app.use(errorHandler)

async function start() {
  try {
    await connectDB()
    initRealtime(server)
    server.listen(PORT, () => console.log(`FYP Manager API running on http://localhost:${PORT}`))
  } catch (err: any) {
    console.error('Failed to start server:', err.message)
    process.exit(1)
  }
}

start()

export default app

