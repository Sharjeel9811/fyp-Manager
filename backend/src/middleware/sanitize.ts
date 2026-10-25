import { NextFunction, Request, Response } from 'express'

/**
 * Mongo operator / prototype keys. Passing `{ "email": { "$ne": null } }` to a
 * controller that forwards the object straight into a Mongoose query can turn
 * a lookup into "match any user" — Mongoose does not stop that on its own.
 * Zod checks happen per route; this is the global safety net.
 */
const FORBIDDEN_KEY = /^\$|\./

function clean<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => clean(entry)) as unknown as T
  }
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY.test(key)) continue
      out[key] = clean(entry)
    }
    return out as T
  }
  return value
}

/**
 * Strips `$`-prefixed and dotted keys from the request body/query before any
 * controller can pass them to the database. Values are left untouched, so
 * normal payloads behave exactly as before.
 *
 * `req.query` is a getter on Express' request prototype that re-parses the URL
 * on every access, so the sanitized copy is defined on the instance instead.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = clean(req.body)
  }

  Object.defineProperty(req, 'query', {
    value: clean(req.query),
    writable: true,
    configurable: true,
    enumerable: true,
  })

  next()
}
