import { Component, OnInit, inject, signal, DOCUMENT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FleetService } from '../../core/api/fleet.service';
import { TripService } from '../../core/api/trip.service';
import { RouteService } from '../../core/api/route.service';
import { UserService } from '../../core/api/user.service';
import { AlertService } from '../fleet/alerts/alert.service';
import { FleetDashboardDto } from '../../core/api/api.types';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  imports: [RouterLink, ButtonModule, TagModule],
})
export class DashboardPage implements OnInit {
  private readonly authService  = inject(AuthService);
  private readonly fleetService = inject(FleetService);
  private readonly tripService  = inject(TripService);
  private readonly routeService = inject(RouteService);
  private readonly userService  = inject(UserService);
  private readonly alertService = inject(AlertService);
  private readonly document     = inject(DOCUMENT);

  readonly user = this.authService.currentUser;

  darkMode = signal(false);

  fleetDashboard  = signal<FleetDashboardDto | null>(null);
  alerts          = this.alertService.alerts;
  activeTrips     = signal(0);
  totalRoutes     = signal(0);
  totalUsers      = signal(0);
  totalDrivers    = signal(0);
  loading         = signal(true);

  ngOnInit(): void {
    this.alertService.start();
    this.loadAll();
    const saved = localStorage.getItem('darkMode') === 'true';
    this.darkMode.set(saved);
    this.document.documentElement.classList.toggle('dark-mode', saved);
  }

  toggleDarkMode(): void {
    const next = !this.darkMode();
    this.darkMode.set(next);
    this.document.documentElement.classList.toggle('dark-mode', next);
    localStorage.setItem('darkMode', String(next));
  }

  private async loadAll(): Promise<void> {
    try {
      const [fleet, trips, routes, users] = await Promise.all([
        firstValueFrom(this.fleetService.getDashboard()),
        firstValueFrom(this.tripService.getTrips()),
        firstValueFrom(this.routeService.getRoutes()),
        firstValueFrom(this.userService.getUsers()),
      ]);
      this.fleetDashboard.set(fleet);
      this.activeTrips.set(trips.filter(t => t.status === 'in_progress').length);
      this.totalRoutes.set(routes.length);
      this.totalUsers.set(users.filter(u => u.role !== 'driver').length);
      this.totalDrivers.set(users.filter(u => u.role === 'driver').length);
    } catch {
      // silencioso
    } finally {
      this.loading.set(false);
    }
  }

  getSeverity(dias: number): string {
    if (dias < 0) return 'danger';
    if (dias <= 7) return 'danger';
    if (dias <= 30) return 'warn';
    return 'success';
  }

  labelTipo(tipo: string): string {
    const map: Record<string, string> = {
      seguro: 'Seguro', vtv: 'VTV',
      habilitacion_turistica: 'Hab. turística',
      habilitacion_comercial: 'Hab. comercial',
      matafuego: 'Matafuego', licencia: 'Licencia',
      libreta_sanitaria: 'Libreta sanitaria',
      curso_puerto: 'Curso de puerto', turno_mecanico: 'Turno mecánico',
    };
    return map[tipo] ?? tipo;
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
