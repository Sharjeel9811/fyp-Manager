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
import { errorHandler } from './middleware/errorHandler'
import { connectDB } from './config/database'
import { initRealtime } from './services/realtime'

const app = express()
const PORT = Number(process.env.PORT || 5000)
const server = http.createServer(app)

app.use(helmet())
app.use(
  cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

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

