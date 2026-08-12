import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

// Validates { body, query, params } against the given Zod schema before the request reaches the controller.
// On failure a ZodError is thrown and forwarded to errorHandler, which formats it into per-field messages.
//
// IMPORTANT: we write the parsed result back onto req — not just validate and discard it.
// Without this, z.coerce.number() on query params has no effect (req.query stays as strings),
// causing Prisma to receive string values for take/skip and throw a 500.
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Write coerced/defaulted values back so controllers receive the right types
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query;
      if (parsed.params !== undefined) req.params = parsed.params;
      next();
    } catch (err) {
      next(err);
    }
  };
}
