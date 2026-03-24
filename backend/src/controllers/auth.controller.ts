import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { AuthService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { UserRepository } from '../repositories/user.repository';
import { ConflictError } from '../shared/errors/app.error';
import { env } from '../config/env';

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

const userRepository = new UserRepository();

export const AuthController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const existing = await userRepository.findByEmail(email);
      if (existing) throw new ConflictError('El email ya está registrado');

      const passwordHash = await bcrypt.hash(password, 12);
      await userRepository.createVerified({ email, passwordHash, role: 'admin' });

      res.status(201).json({
        status: 'success',
        message: 'Cuenta creada correctamente.',
      });
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

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      await AuthService.changePassword(req.user!.sub, currentPassword, newPassword);
      res.json({ status: 'success', message: 'Contraseña actualizada.' });
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
