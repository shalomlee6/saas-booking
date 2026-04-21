import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminApiService, type AdminBusiness } from '../../services/admin-api.service';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './super-admin-dashboard.component.html',
  styleUrl: './super-admin-dashboard.component.scss',
})
export class SuperAdminDashboardComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly businesses = signal<AdminBusiness[]>([]);

  readonly totalBusinesses = computed(() => this.businesses().length);

  readonly recentSignups = computed(() =>
    [...this.businesses()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  );

  ngOnInit(): void {
    this.adminApi.listBusinesses().subscribe({
      next: (items) => {
        this.businesses.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load platform data');
        this.loading.set(false);
      },
    });
  }
}
