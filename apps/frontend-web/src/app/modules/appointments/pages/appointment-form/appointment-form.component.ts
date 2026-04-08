import { Component, inject, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import type { CreateAppointmentDto } from '../../dto/create-appointment.dto';
import { buildCreateAppointmentDtoFromRange } from '../../dto/appointment-dto-adapter';
import { AuthService } from '../../../../core/auth/auth.service';
import * as AppointmentsActions from '../../state/appointments.actions';
import {
  selectError,
  selectCreating,
} from '../../state/appointments.selectors';
import {
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
} from '../../utils/calendar.utils';

@Component({
  selector: 'app-appointment-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './appointment-form.component.html',
  styleUrl: './appointment-form.component.scss',
})
export class AppointmentFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly creating = toSignal(this.store.select(selectCreating), {
    initialValue: false,
  });
  readonly serverError = toSignal(this.store.select(selectError), {
    initialValue: null as string | null,
  });

  readonly form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      customerId: ['', [Validators.required]],
      serviceId: ['', [Validators.required]],
      start: ['', [Validators.required]],
      end: ['', [Validators.required]],
      notes: [''],
    });
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const date = params.get('date');
    const time = params.get('time');
    if (date && time) {
      const startStr = `${date}T${time}`;
      const startDate = new Date(startStr);
      if (!isNaN(startDate.getTime())) {
        const endDate = new Date(startDate.getTime() + DEFAULT_APPOINTMENT_DURATION_MINUTES * 60 * 1000);
        const endStr = this.toDatetimeLocal(endDate);
        this.form.patchValue({
          start: startStr,
          end: endStr,
        });
      }
    }
  }

  /** Format for datetime-local input: YYYY-MM-DDTHH:mm */
  private toDatetimeLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  }

  get customerId() {
    return this.form.get('customerId');
  }
  get serviceId() {
    return this.form.get('serviceId');
  }
  get start() {
    return this.form.get('start');
  }
  get end() {
    return this.form.get('end');
  }

  onSubmit(): void {
    if (this.form.invalid || this.creating()) {
      this.form.markAllAsTouched();
      return;
    }

    const dto: CreateAppointmentDto | null = buildCreateAppointmentDtoFromRange({
      customerId: this.form.get('customerId')?.value ?? '',
      serviceId: this.form.get('serviceId')?.value ?? '',
      startLocal: this.form.get('start')?.value ?? '',
      endLocal: this.form.get('end')?.value ?? '',
      notes: this.form.get('notes')?.value ?? '',
      businessTimezone: this.auth.businessTimezone(),
    });
    if (!dto) return;

    this.store.dispatch(AppointmentsActions.create({ dto }));
  }
}
