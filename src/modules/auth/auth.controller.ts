import type { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { usersRepository } from '../users/users.repository.js';


const REFRESH_COOKIE_NAME = 'refreshToken';

// httpOnly keeps the cookie invisible to JS (XSS-safe); path scoped to /api/auth limits where the browser sends it.
function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export const authController = {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({ user: result.user, accessToken: result.accessToken });
  },

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: { message: 'No refresh token provided' } });
    }
    const result = await authService.refresh(token);
    setRefreshCookie(res, result.refreshToken);
    return res.status(200).json({ accessToken: result.accessToken });
  },

  async logout(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) await authService.logout(token);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth', secure: true, sameSite: 'none' });
    res.status(204).send();
  },

  async me(req: Request, res: Response) {
    // req.user is populated by requireAuth middleware from the JWT sub claim
    const user = await usersRepository.findById(req.user!.id);
    res.json({ user });
  },
};
