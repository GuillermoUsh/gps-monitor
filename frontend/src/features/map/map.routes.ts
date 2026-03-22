import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const MAP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./live-map.component').then(m => m.LiveMapComponent),
    canActivate: [authGuard],
  },
];
