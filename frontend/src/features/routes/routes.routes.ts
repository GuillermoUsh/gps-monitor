import { Routes } from '@angular/router';

export const ROUTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./routes.page').then(m => m.RoutesPage),
  },
];
