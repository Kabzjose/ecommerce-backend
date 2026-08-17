import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
      validated?: {
        body?: unknown;
        query?: Record<string, unknown>;
        params?: Record<string, unknown>;
      };
    }
  }
}

export {};