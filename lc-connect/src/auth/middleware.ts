import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from './oauth.js'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized', error_description: 'Missing Bearer token' })
    return
  }
  try {
    const token = auth.slice(7)
    const payload = verifyAccessToken(token)
    ;(req as any).lcUser = payload
    next()
  } catch {
    res.status(401).json({ error: 'unauthorized', error_description: 'Invalid or expired token' })
  }
}
