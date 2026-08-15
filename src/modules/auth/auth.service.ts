import bcrypt from 'bcrypt';
import { authRepository } from './auth.repository.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/token.js';
import { ConflictError, UnauthorizedError } from '../../lib/errors.js';
import type { RegisterInput, LoginInput } from './auth.schema.js';

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_DAYS = 7;

function refreshExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

// Signs both tokens and persists the refresh token — shared by register, login, and refresh.
async function issueTokenPair(
  userId: string,
  role: 'CUSTOMER' | 'RIDER' | 'ADMIN' | 'BUSINESS',
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId });

  await authRepository.storeRefreshToken({
    token: refreshToken,
    userId,
    expiresAt: refreshExpiryDate(),
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput) {
    const existingEmail = await authRepository.findUserByEmail(input.email);
    if (existingEmail) {
      throw new ConflictError('An account with this email already exists');
    }

    const existingPhone = await authRepository.findUserByPhone(input.phone);
    if (existingPhone) {
      throw new ConflictError('An account with this phone number already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Public registration is always CUSTOMER — riders/admins are created via admin-only endpoints.
    const user = await authRepository.createUser({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: 'CUSTOMER',
    });

    const tokens = await issueTokenPair(user.id, user.role);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    };
  },

  async login(input: LoginInput) {
    const user = await authRepository.findUserByEmail(input.email);

    // Same error for "not found" and "wrong password" — prevents email enumeration.
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedError('Invalid email or password');

    if (!user.isActive) throw new UnauthorizedError('This account has been deactivated');

    const tokens = await issueTokenPair(user.id, user.role);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    };
  },

  async refresh(oldToken: string) {
    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(oldToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const stored = await authRepository.findRefreshToken(oldToken);
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token is no longer valid');
    }

    const user = await authRepository.findUserById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedError('Account no longer active');

    // Rotate: revoke the old token and issue a fresh pair so each refresh token is single-use.
    await authRepository.revokeRefreshToken(oldToken);
    return issueTokenPair(user.id, user.role);
  },

  async logout(token: string) {
    const stored = await authRepository.findRefreshToken(token);
    if (stored) await authRepository.revokeRefreshToken(token);
  },
};
