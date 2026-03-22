import { Routes } from '@angular/router';

export const SIMULATOR_ROUTES: Routes = [
  {
    path: ':tripId',
    loadComponent: () =>
      import('./simulator.page').then(m => m.SimulatorPage),
  },
];
