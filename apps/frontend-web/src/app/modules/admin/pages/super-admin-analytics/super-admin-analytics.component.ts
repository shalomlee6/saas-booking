import { Component, inject, signal, computed } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
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

  range: '7d' | '30d' | '90d' = '7d';
  readonly rangeOptions = [
    { label: 'Last 7 days', value: '7d' as const },
    { label: 'Last 30 days', value: '30d' as const },
    { label: 'Last 90 days', value: '90d' as const },
  ];

  readonly chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
  };

  readonly lineChart = computed(() => {
    const d = this.data();
    if (!d) return null;
    const pts = d.charts.appointmentsByDay;
    return {
      labels: pts.map((p) => p.date),
      datasets: [
        {
          label: 'Appointments',
          data: pts.map((p) => p.count),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
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
    return {
      labels: pts.map((p) => p.label),
      datasets: [
        {
          label: 'New businesses',
          data: pts.map((p) => p.count),
          backgroundColor: '#6366f1',
        },
      ],
    };
  });

  readonly pieChart = computed(() => {
    const d = this.data();
    if (!d) return null;
    const pts = d.charts.planDistribution;
    const colors = ['#94a3b8', '#38bdf8', '#a78bfa', '#f472b6'];
    return {
      labels: pts.map((p) => p.plan),
      datasets: [
        {
          data: pts.map((p) => p.count),
          backgroundColor: pts.map((_, i) => colors[i % colors.length]),
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
    this.loading.set(true);
    this.adminApi.getAnalytics(this.range).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Analytics',
          detail: err?.error?.message ?? 'Failed to load',
        });
      },
    });
  }
}
