import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AuthService } from '../services/auth.service';
import { UserRepository } from '../repositories/user.repository';

const userRepo = new UserRepository();

export const UsersController = {
  async list(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userRepo.findAll();
      res.json({ status: 'success', data: users });
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, role } = req.body;
      const user = await AuthService.createUser(email, password, role);
      res.status(201).json({ status: 'success', data: user });
    } catch (err) {
      next(err);
    }
  },
};
