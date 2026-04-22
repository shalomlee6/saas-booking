import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { DecimalPipe, CurrencyPipe } from '@angular/common';
import { AdminApiService, type AdminOverviewDto } from '../../services/admin-api.service';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [RouterLink, ChartModule, CardModule, SkeletonModule, DecimalPipe, CurrencyPipe],
  templateUrl: './super-admin-dashboard.component.html',
  styleUrl: './super-admin-dashboard.component.scss',
})
export class SuperAdminDashboardComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly overview = signal<AdminOverviewDto | null>(null);

  readonly chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
      },
    },
  };

  readonly trendChart = computed(() => {
    const o = this.overview();
    if (!o || o.chartAppointmentsByMonth.length === 0) return null;
    const pts = o.chartAppointmentsByMonth;
    return {
      labels: pts.map((p) => p.period),
      datasets: [
        {
          label: 'Appointments',
          data: pts.map((p) => p.count),
          borderColor: '#3787F6',
          backgroundColor: 'rgba(55, 135, 246, 0.12)',
          fill: true,
          tension: 0.35,
        },
      ],
    };
  });

  readonly businessGrowthPositive = computed(() => {
    const v = this.overview()?.businessesMonthOverMonthGrowthPercent ?? 0;
    return v > 0;
  });

  readonly appointmentGrowthPositive = computed(() => {
    const v = this.overview()?.monthOverMonthGrowthPercent ?? 0;
    return v >= 0;
  });

  ngOnInit(): void {
    this.adminApi.getOverview().subscribe({
      next: (data) => {
        this.overview.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load platform overview');
        this.loading.set(false);
      },
    });
  }
}
