import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, switchMap, map, shareReplay } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';


export interface Insights {
  totalRevenue: number;
  revenueByService: { serviceName: string; total: number }[];
  revenueByWeekday: { weekday: number; total: number }[];
  inactiveCustomersCount: number;
  topCustomers: { name: string; total: number }[];
}

interface InsightsApiResponse {
  totalRevenue: number;
  revenueByService: { serviceName?: string; total: number }[];
  revenueByWeekday: { weekday: number; total: number }[];
  inactiveCustomersCount: number;
  topCustomers: { name?: string; total: number }[];
}

@Injectable({ providedIn: 'root' })
export class GrowthBrainService {
  private readonly api = inject(ApiService);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  /**
   * Observable that re-fetches when refresh() is called.
   * Use async pipe in templates; do not manually subscribe.
   * shareReplay(1) so multiple async pipes share one subscription.
   */
  readonly insights$: Observable<Insights> = this.refresh$.pipe(
    switchMap(() =>
      this.api.get<InsightsApiResponse>('business/insights').pipe(
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
        }))
      )
    ),
    shareReplay(1)
  );

  refresh(): void {
    this.refresh$.next();
  }
}
