import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TenantService } from '../../../core/tenant/tenant.service';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-setup-page',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule],
  templateUrl: './setup.page.html',
  styleUrl: './setup.page.scss',
})
export class SetupPage {
  private readonly fb            = inject(FormBuilder);
  private readonly router        = inject(Router);
  private readonly tenantService = inject(TenantService);

  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    slug: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-z0-9-]+$/)]],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const slug = this.form.value.slug!.toLowerCase().trim();
    localStorage.setItem('agency_slug', slug);
    this.router.navigate(['/login']);
  }
}
