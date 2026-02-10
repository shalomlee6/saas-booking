import { Injectable, signal, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import type { Appointment } from '../model/appointment';
import type { CreateAppointmentDto } from '../dto/create-appointment.dto';
import type { AppointmentsListParams } from './appointments-api.service';
import { AppointmentsApiService } from './appointments-api.service';

@Injectable({ providedIn: 'root' })
export class AppointmentsStore {
  private readonly api = inject(AppointmentsApiService);

  readonly items = signal<Appointment[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(params?: AppointmentsListParams): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list(params).subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to load appointments');
        this.loading.set(false);
      },
    });
  }

  /** Returns observable so caller can navigate on success. Updates items and error. */
  create(dto: CreateAppointmentDto): Observable<Appointment> {
    this.error.set(null);
    return this.api.create(dto).pipe(
      tap({
        next: (created) => this.items.update((prev) => [created, ...prev]),
        error: (err) =>
          this.error.set(
            err?.error?.message || 'Failed to create appointment'
          ),
      })
    );
  }
}
