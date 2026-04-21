import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Observable,
  BehaviorSubject,
  switchMap,
  map,
  shareReplay,
  combineLatest,
} from 'rxjs';
import { ApiService } from '../../../core/api/api.service';

export type InsightsPeriod = 'week' | 'month' | 'year';

export interface Insights {
  totalRevenue: number;
  revenueByService: { serviceName: string; total: number }[];
  revenueByWeekday: { weekday: number; total: number }[];
  inactiveCustomersCount: number;
  topCustomers: { name: string; total: number }[];
  appointmentsCount: number;
  period: InsightsPeriod;
}

interface InsightsApiResponse {
  totalRevenue: number;
  revenueByService: { serviceName?: string; total: number }[];
  revenueByWeekday: { weekday: number; total: number }[];
  inactiveCustomersCount: number;
  topCustomers: { name?: string; total: number }[];
  appointmentsCount?: number;
  period?: InsightsPeriod;
}

@Injectable({ providedIn: 'root' })
export class GrowthBrainService {
  private readonly api = inject(ApiService);

  private readonly period$ = new BehaviorSubject<InsightsPeriod>('month');
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  /** Current dashboard period for pill active state. */
  readonly selectedPeriod = toSignal(this.period$, { initialValue: 'month' });

  /**
   * Observable that re-fetches when refresh() is called or period changes.
   * Use async pipe in templates; do not manually subscribe.
   */
  readonly insights$: Observable<Insights> = combineLatest([this.period$, this.refresh$]).pipe(
    switchMap(([period]) =>
      this.api
        .get<InsightsApiResponse>(`business/insights?period=${encodeURIComponent(period)}`)
        .pipe(
          map((res) => ({
            totalRevenue: res.totalRevenue ?? 0,
            revenueByService: (res.revenueByService ?? []).map((r) => ({
              serviceName: r.serviceName ?? '',
              total: r.total ?? 0,
            })),
            revenueByWeekday: res.revenueByWeekday ?? [],
            inactiveCustomersCount: res.inactiveCustomersCount ?? 0,
            topCustomers: (res.topCustomers ?? []).map((c) => ({
              name: c.name ?? '',
              total: c.total ?? 0,
            })),
            appointmentsCount: res.appointmentsCount ?? 0,
            period: (res.period as InsightsPeriod) ?? period,
          }))
        )
    ),
    shareReplay(1)
  );

  setPeriod(p: InsightsPeriod): void {
    this.period$.next(p);
  }

  refresh(): void {
    this.refresh$.next();
  }
}
