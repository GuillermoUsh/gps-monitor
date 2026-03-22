import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

export const AuthController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      await AuthService.register(email, password);
      res.status(201).json({
        status: 'success',
        message: 'Cuenta creada. Verificá tu email para continuar.',
      });
    } catch (err) {
      next(err);
    }
  },

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.query as { token: string };
      await AuthService.verifyEmail(token);
      res.json({ status: 'success', message: 'Email verificado correctamente.' });
    } catch (err) {
      next(err);
    }
  },

  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      await AuthService.resendVerification(email);
      res.json({ status: 'success', message: 'Email de verificación reenviado.' });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
      res.json({
        status: 'success',
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE];
      if (!refreshToken) {
        res.status(401).json({ status: 'error', message: 'Refresh token no encontrado' });
        return;
      }
      const result = await AuthService.refresh(refreshToken);
      res.cookie(REFRESH_COOKIE, result.newRefreshToken, COOKIE_OPTIONS);
      res.json({ status: 'success', data: { accessToken: result.accessToken } });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE];
      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }
      res.clearCookie(REFRESH_COOKIE);
      res.json({ status: 'success', message: 'Sesión cerrada.' });
    } catch (err) {
      next(err);
    }
  },
};
