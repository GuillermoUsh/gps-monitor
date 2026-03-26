import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const FLEET_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./fleet-dashboard.page').then(m => m.FleetDashboardPage),
  },
  {
    path: 'vehicles',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./vehicles/vehicles.page').then(m => m.VehiclesPage),
  },
  {
    path: 'vehicles/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./vehicles/vehicle-detail.page').then(m => m.VehicleDetailPage),
  },
  {
    path: 'drivers',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./drivers/drivers.page').then(m => m.DriversPage),
  },
];
