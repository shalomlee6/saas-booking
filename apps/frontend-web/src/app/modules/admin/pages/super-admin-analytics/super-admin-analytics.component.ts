import { Component, inject, signal, computed } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
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
    CurrencyPipe,
    DecimalPipe,
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
          borderColor: '#3787F6',
          backgroundColor: 'rgba(55, 135, 246, 0.14)',
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
          borderColor: '#0F172A',
          backgroundColor: 'rgba(15, 23, 42, 0.08)',
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
          backgroundColor: '#3787F6',
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
      if (p === 'free') return '#94a3b8';
      if (p === 'pro' || p === 'normal') return '#3787F6';
      if (p === 'premium') return '#d97706';
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
