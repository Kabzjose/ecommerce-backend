import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// Central error handler — must be registered last in app.ts so all next(err) calls land here.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        message: 'Validation failed',
        fields: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err }, err.message);
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }

  // Handle Prisma unique constraint violations (P2002)
  if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
    const meta = (err as { meta?: { target?: string[] | string } }).meta;
    const targetArray = Array.isArray(meta?.target) ? meta.target : typeof meta?.target === 'string' ? [meta.target] : [];
    const fieldName = targetArray.length > 0 ? targetArray[0] : 'field';
    
    res.status(409).json({
      error: {
        message: `An account with this ${fieldName} already exists`,
        fields: { [fieldName]: [`This ${fieldName} is already registered`] },
      },
    });
    return;
  }

  // Unknown error — log the full details but never expose internals to the client.
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { message: 'An unexpected error occurred' } });
}
