import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, switchMap, map, shareReplay } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Appointment, AppointmentListItem } from '../model/appointment';
import type { CreateAppointmentDto } from '../dto/create-appointment.dto';

export interface AppointmentsListParams {
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentsApiService {
  private readonly api = inject(ApiService);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  /**
   * Reactive stream: re-fetches when refresh() is called. Default params for dashboard.
   * shareReplay(1) ensures multiple subscribers (e.g. dashboard + growth-brain) share
   * a single HTTP request instead of each triggering their own.
   */
  readonly appointments$ = this.refresh$.pipe(
    switchMap(() => this.list({})),
    shareReplay(1)
  );

  refresh(): void {
    this.refresh$.next();
  }

  /** GET /api/appointments?from=...&to=... Returns flattened DTO; map to Appointment with start/end as Date for calendar. */
  list(params?: AppointmentsListParams): Observable<Appointment[]> {
    let path = 'appointments';
    if (params?.from || params?.to) {
      const q = new URLSearchParams();
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
      path += `?${q.toString()}`;
    }
    let invalidDateLogged = false;
    return this.api.get<AppointmentListItem[]>(path).pipe(
      map((dtos) =>
        dtos
          .map((d) => {
            const start = new Date(d.start as string | number | Date);
            const end = new Date(d.end as string | number | Date);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
              if (!invalidDateLogged) {
                console.warn('[AppointmentsApiService] Skipping appointment with invalid start/end', d);
                invalidDateLogged = true;
              }
              return null;
            }
            return {
              _id: d.appointmentId,
              start,
              end,
              status: d.status,
              price: d.price,
              durationMinutes: d.durationMinutes,
              serviceName: d.serviceName,
              customerName: d.customerName,
              customerPhone: d.customerPhone ?? undefined,
            } as Appointment;
          })
          .filter((a): a is Appointment => a != null)
      )
    );
  }

  /** POST /api/appointments */
  create(dto: CreateAppointmentDto): Observable<Appointment> {
    return this.api.post<Appointment>('appointments', dto);
  }

  /** PUT /api/appointments/:id */
  update(id: string, body: Partial<{ start: string; end: string; status: string; notes: string }>): Observable<Appointment> {
    return this.api.put<Appointment>(`appointments/${id}`, body);
  }

  /** DELETE /api/appointments/:id (cancels) */
  cancel(id: string): Observable<unknown> {
    return this.api.delete(`appointments/${id}`);
  }
}
