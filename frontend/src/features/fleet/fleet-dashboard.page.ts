import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { FleetService } from '../../core/api/fleet.service';
import { FleetDashboardDto } from '../../core/api/api.types';

@Component({
  selector: 'app-fleet-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    ButtonModule,
    CardModule,
    TagModule,
    BadgeModule,
    ToolbarModule,
    ToastModule,
  ],
  templateUrl: './fleet-dashboard.page.html',
  styleUrl: './fleet-dashboard.page.scss',
  providers: [MessageService],
})
export class FleetDashboardPage implements OnInit {
  private readonly fleetService = inject(FleetService);
  private readonly messageService = inject(MessageService);

  loading = signal(false);
  dashboard = signal<FleetDashboardDto | null>(null);

  ngOnInit(): void {
    this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.fleetService.getDashboard());
      this.dashboard.set(data);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo cargar el dashboard de flota',
      });
    } finally {
      this.loading.set(false);
    }
  }

  getDocSeverity(diasRestantes: number): 'danger' | 'warn' | 'success' {
    if (diasRestantes < 7) return 'danger';
    if (diasRestantes < 30) return 'warn';
    return 'success';
  }
}
