import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const TRIPS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./trip-list.component').then(m => m.TripListComponent),
    canActivate: [authGuard],
  },
  {
    path: ':tripId/history',
    loadComponent: () =>
      import('./trip-history.page').then(m => m.TripHistoryPage),
    canActivate: [authGuard],
  },
];
