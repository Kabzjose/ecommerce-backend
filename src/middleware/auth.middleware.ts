import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/token.js';
import { UnauthorizedError } from '../lib/errors.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed authorization header'));
  }

  const token = header.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}