import { Component, inject } from '@angular/core';
import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, map, of, shareReplay, startWith } from 'rxjs';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { AppointmentsApiService } from '../../../appointments/services/appointments-api.service';
import type { Appointment } from '../../../appointments/model/appointment';
import {
  GrowthBrainService,
  type InsightsPeriod,
} from '../../services/growth-brain.service';

const WEEKDAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const VIP_THRESHOLD = 500;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CardModule,
    TagModule,
    TableModule,
    ChartModule,
    AsyncPipe,
    CurrencyPipe,
    DatePipe,
    RouterLink,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly appointmentsApi = inject(AppointmentsApiService);
  readonly growthBrain = inject(GrowthBrainService);

  readonly appointments$ = this.appointmentsApi.appointments$;
  readonly topAppointments$ = this.appointments$.pipe(
    map((list) => list.slice(0, 10)),
    shareReplay(1)
  );
  readonly insights$ = this.growthBrain.insights$;
  readonly selectedPeriod = this.growthBrain.selectedPeriod;

  readonly chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
  };

  /** Chart data: revenue by weekday (Mongo $dayOfWeek 1=Sun .. 7=Sat) */
  readonly revenueByWeekdayChart$ = this.insights$.pipe(
    map((i) => {
      const totals = new Array(7).fill(0);
      (i.revenueByWeekday ?? []).forEach((r) => {
        const idx = r.weekday >= 1 && r.weekday <= 7 ? r.weekday - 1 : 0;
        totals[idx] = r.total;
      });
      return {
        labels: WEEKDAY_LABELS,
        datasets: [{ label: 'הכנסות', data: totals }],
      };
    }),
    catchError(() => of(null))
  );

  /** Chart data: revenue by service */
  readonly revenueByServiceChart$ = this.insights$.pipe(
    map((i) => {
      const list = i.revenueByService ?? [];
      return {
        labels: list.map((r) => r.serviceName || '—'),
        datasets: [{ label: 'הכנסות', data: list.map((r) => r.total) }],
      };
    }),
    catchError(() => of(null))
  );

  readonly vipThreshold = VIP_THRESHOLD;

  readonly insightsState$ = this.insights$.pipe(
    map((insights) => ({ loading: false, error: false, insights })),
    startWith({ loading: true, error: false, insights: null }),
    catchError(() =>
      of({ loading: false, error: true, insights: null })
    )
  );

  readonly topAppointmentsState$ = this.topAppointments$.pipe(
    map((list) => ({ loading: false, error: false, list })),
    startWith({ loading: true, error: false, list: [] as Appointment[] }),
    catchError(() =>
      of({ loading: false, error: true, list: [] as Appointment[] })
    )
  );

  setPeriod(p: InsightsPeriod): void {
    this.growthBrain.setPeriod(p);
  }

  retryInsights(): void {
    this.growthBrain.refresh();
  }

  retryAppointments(): void {
    this.appointmentsApi.refresh();
  }
}
