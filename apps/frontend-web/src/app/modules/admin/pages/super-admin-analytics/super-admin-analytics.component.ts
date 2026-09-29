import { Component, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AdminApiService, type AdminAnalyticsDto } from '../../services/admin-api.service';
import { SaCurrencyPipe } from '../../shared/sa-currency.pipe';

@Component({
  selector: 'app-super-admin-analytics',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    SelectModule,
    CardModule,
    ChartModule,
    SkeletonModule,
    ToastModule,
    InputTextModule,
    DecimalPipe,
    SaCurrencyPipe,
  ],
  templateUrl: './super-admin-analytics.component.html',
  styleUrl: './super-admin-analytics.component.scss',
})
export class SuperAdminAnalyticsComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly data = signal<AdminAnalyticsDto | null>(null);
  readonly error = signal<string | null>(null);

  rangeMode: '7d' | '30d' | '90d' | 'custom' = '7d';
  customFrom = '';
  customTo = '';

  readonly rangeOptions = [
    { label: 'Last 7 days', value: '7d' as const },
    { label: 'Last 30 days', value: '30d' as const },
    { label: 'Last 90 days', value: '90d' as const },
    { label: 'Custom', value: 'custom' as const },
  ];

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
      },
    },
  };

  // Pie charts need a fixed 1:1 aspect ratio — reusing chartOptions'
  // maintainAspectRatio:false let the canvas stretch to the card's
  // rectangular width while staying a fixed height, rendering an oval.
  readonly pieChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
      },
    },
  };

  readonly lineChart = computed(() => {
    const d = this.data();
    if (!d) return null;
    const pts = d.charts.appointmentsByDay;
    if (pts.length === 0) return null;
    return {
      labels: pts.map((p) => p.date),
      datasets: [
        {
          label: 'Appointments',
          data: pts.map((p) => p.count),
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.14)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  });

  readonly revenueLineChart = computed(() => {
    const d = this.data();
    if (!d) return null;
    const pts = d.charts.revenueByDay ?? [];
    if (pts.length === 0) return null;
    return {
      labels: pts.map((p) => p.date),
      datasets: [
        {
          label: 'Revenue (ILS)',
          data: pts.map((p) => p.amount),
          borderColor: '#0d9488',
          backgroundColor: 'rgba(13, 148, 136, 0.12)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  });

  readonly barChart = computed(() => {
    const d = this.data();
    if (!d) return null;
    const pts = d.charts.newBusinessesByWeek;
    if (pts.length === 0) return null;
    return {
      labels: pts.map((p) => p.label),
      datasets: [
        {
          label: 'New businesses',
          data: pts.map((p) => p.count),
          backgroundColor: '#2563eb',
        },
      ],
    };
  });

  readonly pieChart = computed(() => {
    const d = this.data();
    if (!d) return null;
    const pts = d.charts.planDistribution;
    if (pts.length === 0) return null;
    const colorFor = (plan: string): string => {
      const p = (plan || 'unknown').toLowerCase();
      if (p === 'free') return '#64748b';
      if (p === 'pro' || p === 'normal') return '#2563eb';
      if (p === 'premium') return '#7c3aed';
      return '#cbd5e1';
    };
    return {
      labels: pts.map((p) => p.plan),
      datasets: [
        {
          data: pts.map((p) => p.count),
          backgroundColor: pts.map((p) => colorFor(p.plan)),
        },
      ],
    };
  });

  constructor() {
    this.refresh();
  }

  onRangeChange(): void {
    this.refresh();
  }

  refresh(): void {
    if (this.rangeMode === 'custom') {
      if (!this.customFrom || !this.customTo) {
        this.messages.add({
          severity: 'warn',
          summary: 'Custom range',
          detail: 'Choose a start and end date.',
        });
        return;
      }
    }
    this.loading.set(true);
    this.error.set(null);
    const req =
      this.rangeMode === 'custom'
        ? this.adminApi.getAnalytics('custom', { from: this.customFrom, to: this.customTo })
        : this.adminApi.getAnalytics(this.rangeMode);
    req.subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to load analytics');
        this.messages.add({
          severity: 'error',
          summary: 'Analytics',
          detail: err?.error?.message ?? 'Failed to load',
        });
      },
    });
  }
}
