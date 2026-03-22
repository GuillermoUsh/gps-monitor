import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Try to refresh silently
  const refreshed = await authService.refresh();
  if (refreshed) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
