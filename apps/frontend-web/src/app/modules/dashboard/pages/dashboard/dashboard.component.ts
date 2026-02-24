import { Component, inject } from '@angular/core';
import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { AppointmentsApiService } from '../../../appointments/services/appointments-api.service';
import { GrowthBrainService } from '../../services/growth-brain.service';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VIP_THRESHOLD = 500;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    ButtonModule,
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
  readonly insights$ = this.growthBrain.getInsights();

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
        datasets: [{ label: 'Revenue', data: totals }],
      };
    })
  );

  /** Chart data: revenue by service */
  readonly revenueByServiceChart$ = this.insights$.pipe(
    map((i) => {
      const list = i.revenueByService ?? [];
      return {
        labels: list.map((r) => r.serviceName || '—'),
        datasets: [{ label: 'Revenue', data: list.map((r) => r.total) }],
      };
    })
  );

  readonly vipThreshold = VIP_THRESHOLD;
}
