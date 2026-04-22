import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  AdminApiService,
  type AdminAlertItem,
  type AdminAlertSeverity,
} from '../../services/admin-api.service';

@Component({
  selector: 'app-super-admin-alerts',
  standalone: true,
  imports: [ButtonModule, CardModule, TagModule, SkeletonModule, ToastModule, DatePipe],
  templateUrl: './super-admin-alerts.component.html',
  styleUrl: './super-admin-alerts.component.scss',
})
export class SuperAdminAlertsComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly items = signal<AdminAlertItem[]>([]);
  readonly error = signal<string | null>(null);
  readonly actingId = signal<string | null>(null);

  constructor() {
    this.load();
  }

  severityLabel(s: AdminAlertSeverity): string {
    return s === 'error' ? 'Error' : s === 'warning' ? 'Warning' : 'Info';
  }

  severityTag(s: AdminAlertSeverity): 'danger' | 'warn' | 'info' | 'secondary' {
    if (s === 'error') return 'danger';
    if (s === 'warning') return 'warn';
    return 'info';
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminApi.getAlerts().subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to load alerts');
      },
    });
  }

  dismiss(a: AdminAlertItem): void {
    this.actingId.set(a.id);
    this.adminApi.dismissAlert(a.id).subscribe({
      next: () => {
        this.actingId.set(null);
        this.messages.add({ severity: 'success', summary: 'Dismissed', detail: a.title });
        this.load();
      },
      error: (err) => {
        this.actingId.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'Dismiss failed',
          detail: err?.error?.message ?? 'Request failed',
        });
      },
    });
  }

  resolve(a: AdminAlertItem): void {
    this.actingId.set(a.id);
    this.adminApi.resolveAlert(a.id).subscribe({
      next: () => {
        this.actingId.set(null);
        this.messages.add({ severity: 'success', summary: 'Resolved', detail: a.title });
        this.load();
      },
      error: (err) => {
        this.actingId.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'Resolve failed',
          detail: err?.error?.message ?? 'Request failed',
        });
      },
    });
  }
}
