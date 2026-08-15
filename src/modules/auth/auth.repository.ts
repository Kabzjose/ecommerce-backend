import { prisma } from '../../config/db.js';
import type { Role } from '@prisma/client';

// All Prisma calls for auth live here — the service layer stays ORM-agnostic.
export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findUserByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  },

  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  createUser(data: {
    name: string;
    email: string;
    phone: string;
    passwordHash: string;
    role?: Role;
  }) {
    return prisma.user.create({ data });
  },

  storeRefreshToken(data: { token: string; userId: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data });
  },

  findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({ where: { token } });
  },

  revokeRefreshToken(token: string) {
    return prisma.refreshToken.update({
      where: { token },
      data: { revoked: true },
    });
  },

  // Revokes every token for a user — useful for password changes or "logout everywhere".
  revokeAllUserTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  },
};
