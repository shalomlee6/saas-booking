import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AppointmentsStore } from '../../services/appointments.store';
import type { CreateAppointmentDto } from '../../dto/create-appointment.dto';

@Component({
  selector: 'app-appointment-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './appointment-form.component.html',
  styleUrl: './appointment-form.component.scss',
})
export class AppointmentFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AppointmentsStore);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);

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

  /** Convert datetime-local value to ISO string */
  private toISO(value: string): string {
    if (!value) return '';
    return new Date(value).toISOString();
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    const dto: CreateAppointmentDto = {
      customerId: this.form.get('customerId')?.value?.trim(),
      serviceId: this.form.get('serviceId')?.value?.trim(),
      start: this.toISO(this.form.get('start')?.value),
      end: this.toISO(this.form.get('end')?.value),
      notes: this.form.get('notes')?.value?.trim() || undefined,
    };

    this.store.create(dto).subscribe({
      next: () => {
        this.router.navigate(['/appointments']);
      },
      error: () => {
        this.loading.set(false);
        this.serverError.set(
          this.store.error() || 'Failed to create appointment. Please try again.'
        );
      },
    });
  }
}
