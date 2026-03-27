import { Injectable, inject, signal } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { FleetService } from '../../../core/api/fleet.service';
import { AlertItemDto } from '../../../core/api/api.types';

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly fleetService = inject(FleetService);
  private readonly messageService = inject(MessageService);

  alerts = signal<AlertItemDto[]>([]);
  alertDays = signal(30);

  private subscription: Subscription | null = null;
  private readonly POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

  start(): void {
    if (this.subscription) return;
    this.subscription = interval(this.POLL_INTERVAL_MS).pipe(
      startWith(0),
      switchMap(() => this.fleetService.getAlerts(this.alertDays())),
    ).subscribe({
      next: (items) => {
        this.alerts.set(items);
        this.showToasts(items);
      },
      error: () => {},
    });
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private showToasts(items: AlertItemDto[]): void {
    const urgent  = items.filter(i => i.dias_restantes <= 7);
    const warning = items.filter(i => i.dias_restantes > 7 && i.dias_restantes <= 30);

    urgent.forEach(item => {
      this.messageService.add({
        severity: 'error',
        summary: `Vence en ${item.dias_restantes} días`,
        detail: `${item.entidad} — ${this.labelTipo(item.subtipo)}`,
        life: 8000,
      });
    });

    if (warning.length > 0) {
      this.messageService.add({
        severity: 'warn',
        summary: `${warning.length} vencimiento(s) próximo(s)`,
        detail: `Revisá el panel de flota para más detalles`,
        life: 6000,
      });
    }
  }

  labelTipo(tipo: string): string {
    const map: Record<string, string> = {
      seguro: 'Seguro',
      vtv: 'VTV',
      habilitacion_turistica: 'Hab. turística',
      habilitacion_comercial: 'Hab. comercial',
      matafuego: 'Matafuego',
      licencia: 'Licencia de conducir',
      libreta_sanitaria: 'Libreta sanitaria',
      curso_puerto: 'Curso de puerto',
      turno_mecanico: 'Turno mecánico',
    };
    return map[tipo] ?? tipo;
  }

  getSeverity(dias: number): string {
    if (dias <= 7) return 'danger';
    if (dias <= 30) return 'warn';
    return 'ok';
  }
}
