import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, switchMap, map, shareReplay } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Appointment, AppointmentListItem } from '../model/appointment';
import type { CreateAppointmentDto } from '../dto/create-appointment.dto';
import {
  buildUpdateAppointmentDto,
  mapAppointmentDtoToModel,
} from '../dto/appointment-dto-adapter';

export interface AppointmentsListParams {
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentsApiService {
  private readonly api = inject(ApiService);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  /**
   * Reactive stream: re-fetches when refresh() is called.
   * Uses GET /api/appointments with no query: server defaults to **start of today → +30 calendar days**
   * (see `getAppointmentsList` in the API).
   * Pass `{ from, to }` to `list()` for a custom window.
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
    return this.api.get<AppointmentListItem[]>(path).pipe(
      map((dtos) => dtos.map((d) => mapAppointmentDtoToModel(d)).filter((a): a is Appointment => a != null))
    );
  }

  /** POST /api/appointments */
  create(dto: CreateAppointmentDto): Observable<Appointment> {
    return this.api.post<Appointment>('appointments', dto);
  }

  /** PUT /api/appointments/:id */
  update(id: string, body: Partial<{ start: string; end: string; status: string; notes: string }>): Observable<Appointment> {
    return this.api.put<Appointment>(`appointments/${id}`, buildUpdateAppointmentDto(body));
  }

  /** GET /api/appointments/:id — single appointment for edit screen */
  getById(id: string): Observable<AppointmentDetailDto> {
    return this.api.get<AppointmentDetailDto>(`appointments/${id}`);
  }

  /** PATCH /api/appointments/:id */
  patchAppointment(id: string, body: PatchAppointmentBody): Observable<Appointment> {
    return this.api.patch<Appointment>(`appointments/${id}`, body);
  }

  /** Soft-cancel: PATCH status to cancelled (preferred over DELETE). */
  cancel(id: string): Observable<Appointment> {
    return this.patchAppointment(id, { status: 'cancelled' });
  }
}

/** Response shape from GET /api/appointments/:id */
export interface AppointmentDetailDto {
  appointmentId: string;
  customerId: string | null;
  serviceId: string;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  durationMinutes: number;
  price?: number;
  start: string;
  end: string;
  status: string;
  notes: string | null;
}

export interface PatchAppointmentBody {
  customerId?: string;
  serviceId?: string;
  start?: string;
  end?: string;
  price?: number;
  status?: string;
  notes?: string;
}
