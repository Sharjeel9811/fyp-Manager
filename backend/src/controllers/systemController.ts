import { Request, Response } from 'express'
import { dbState, ensureDB } from '../config/database'

export function systemHealth(_req: Request, res: Response) {
  // A monitoring ping is the cheapest moment to recover a dropped connection:
  // fire-and-forget so the probe still answers instantly, and the next real
  // request finds an open connection.
  if (dbState() !== 'connected') {
    ensureDB().catch(() => {})
  }
  res.json({
    status: dbState() === 'connected' ? 'ok' : 'degraded',
    service: 'FYP Manager API',
    database: dbState(),
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
}
