import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as { body?: unknown; query?: Record<string, unknown>; params?: Record<string, unknown> };

      // Store validated/coerced values separately — req.query is read-only in Express 5,
      // so mutating it in place is unreliable. Controllers read from req.validated instead.
      req.validated = {
        body: parsed.body ?? req.body,
        query: parsed.query ?? (req.query as Record<string, unknown>),
        params: parsed.params ?? (req.params as Record<string, unknown>),
      };

      // Body can still usually be reassigned safely (it's a plain parsed object from express.json())
      if (parsed.body !== undefined) req.body = parsed.body;

      next();
    } catch (err) {
      next(err);
    }
  };
}