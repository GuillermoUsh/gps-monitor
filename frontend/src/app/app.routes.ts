import { Routes } from '@angular/router';
import { authGuard } from '../core/auth/auth.guard';
import { tenantGuard } from '../core/tenant/tenant.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'setup',
    loadComponent: () =>
      import('../features/auth/setup/setup.page').then((m) => m.SetupPage),
  },
  {
    path: 'login',
    canActivate: [tenantGuard],
    loadComponent: () =>
      import('../features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('../features/auth/register-agency/register-agency.page').then(
        (m) => m.RegisterAgencyPage,
      ),
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('../features/auth/verify-email/verify-email.page').then(
        (m) => m.VerifyEmailPage,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../features/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'map',
    loadChildren: () =>
      import('../features/map/map.routes').then((m) => m.MAP_ROUTES),
  },
  {
    path: 'trips',
    loadChildren: () =>
      import('../features/trips/trips.routes').then((m) => m.TRIPS_ROUTES),
  },
  {
    path: 'routes',
    canActivate: [authGuard],
    loadChildren: () =>
      import('../features/routes/routes.routes').then((m) => m.ROUTES_ROUTES),
  },
  {
    path: 'simulator',
    canActivate: [authGuard],
    loadChildren: () =>
      import('../features/simulator/simulator.routes').then((m) => m.SIMULATOR_ROUTES),
  },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../features/users/users.page').then((m) => m.UsersPage),
  },
  {
    path: 'driver',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../features/driver/driver.page').then((m) => m.DriverPage),
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
