import { Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import type { CreateAppointmentDto } from '../../dto/create-appointment.dto';
import * as AppointmentsActions from '../../state/appointments.actions';
import {
  selectError,
  selectCreating,
} from '../../state/appointments.selectors';

@Component({
  selector: 'app-appointment-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './appointment-form.component.html',
  styleUrl: './appointment-form.component.scss',
})
export class AppointmentFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);

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

  private toISO(value: string): string {
    if (!value) return '';
    return new Date(value).toISOString();
  }

  onSubmit(): void {
    if (this.form.invalid || this.creating()) {
      this.form.markAllAsTouched();
      return;
    }

    const dto: CreateAppointmentDto = {
      customerId: this.form.get('customerId')?.value?.trim(),
      serviceId: this.form.get('serviceId')?.value?.trim(),
      start: this.toISO(this.form.get('start')?.value),
      end: this.toISO(this.form.get('end')?.value),
      notes: this.form.get('notes')?.value?.trim() || undefined,
    };

    this.store.dispatch(AppointmentsActions.create({ dto }));
  }
}
