import mongoose from 'mongoose'

let listenersInstalled = false
let connecting: Promise<void> | null = null

function installListeners() {
  if (listenersInstalled) return
  listenersInstalled = true
  mongoose.connection.on('connected', () => console.log('MongoDB connected'))
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message))
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'))
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env')
  }

  mongoose.set('strictQuery', true)
  installListeners()

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
}

/**
 * Connect only when the connection is not open.
 *
 * On serverless (Vercel Fluid compute) a warm sandbox is reused between
 * invocations and MongoDB Atlas drops idle connections. When that happens
 * `readyState` falls back to 0 and Mongoose buffers every query until the
 * request times out — the UI then spins forever instead of recovering. Calling
 * this before handling a request re-opens the connection on the first request
 * after a drop. Concurrent callers share one in-flight attempt.
 */
export async function ensureDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) return
  if (connecting) return connecting

  connecting = connectDB().finally(() => {
    connecting = null
  })
  return connecting
}

export function dbState(): string {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting']
  return states[mongoose.connection.readyState] || 'unknown'
}
