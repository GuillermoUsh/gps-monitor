import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  imports: [RouterLink, ButtonModule, ToolbarModule],
})
export class DashboardPage {
  private readonly authService = inject(AuthService);

  readonly user = this.authService.currentUser;

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
