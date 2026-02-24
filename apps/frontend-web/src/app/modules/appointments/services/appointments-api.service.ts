import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, switchMap, map } from 'rxjs';
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

  /** Reactive stream: re-fetches when refresh() is called. Default params (from/to) for dashboard. */
  readonly appointments$ = this.refresh$.pipe(
    switchMap(() => this.list({}))
  );

  refresh(): void {
    this.refresh$.next();
  }

  /** GET /api/appointments?from=...&to=... Returns flattened DTO; map to Appointment for store. */
  list(params?: AppointmentsListParams): Observable<Appointment[]> {
    let path = 'appointments';
    if (params?.from || params?.to) {
      const q = new URLSearchParams();
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
      path += `?${q.toString()}`;
    }
    return this.api.get<AppointmentListItem[]>(path).pipe(
      map((dtos) =>
        dtos.map((d) => {
          const start = typeof d.start === 'string' ? d.start : (d.start as any)?.toISOString?.() ?? '';
          const end = typeof d.end === 'string' ? d.end : (d.end as any)?.toISOString?.() ?? '';
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
