import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UserRole } from '../shared/types';
import { ForbiddenError } from '../shared/errors/app.error';

export function requireRole(roles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError('No tenés permiso para realizar esta acción');
    }
    next();
  };
}
