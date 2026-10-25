import { Request, Response } from 'express'
import { dbState } from '../config/database'

export function systemHealth(_req: Request, res: Response) {
  res.json({
    status: dbState() === 'connected' ? 'ok' : 'degraded',
    service: 'FYP Manager API',
    database: dbState(),
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
}
