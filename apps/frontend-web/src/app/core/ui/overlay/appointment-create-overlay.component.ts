import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
  computed,
  effect,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Actions, ofType } from '@ngrx/effects';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { take, forkJoin, lastValueFrom } from 'rxjs';
import { ApiService } from '../../api/api.service';
import * as AppointmentsActions from '../../../modules/appointments/state/appointments.actions';
import {
  selectError,
  selectCreating,
} from '../../../modules/appointments/state/appointments.selectors';
import type { CreateAppointmentDto } from '../../../modules/appointments/dto/create-appointment.dto';
import { DEFAULT_APPOINTMENT_DURATION_MINUTES } from '../../../modules/appointments/utils/calendar.utils';

export interface CustomerOption {
  _id: string;
  name?: string;
}

export interface ServiceOption {
  _id: string;
  name?: string;
}

@Component({
  selector: 'app-appointment-create-overlay',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './appointment-create-overlay.component.html',
  styleUrl: './appointment-create-overlay.component.scss',
})
export class AppointmentCreateOverlayComponent {
  private readonly store = inject(Store);
  private readonly actions = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  @Input() set open(value: boolean) {
    this.openSignal.set(!!value);
  }
  @Input() date = '';
  @Input() time = '';
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  readonly openSignal = signal(false);
  readonly customers = signal<CustomerOption[]>([]);
  readonly services = signal<ServiceOption[]>([]);
  readonly loadingOptions = signal(false);
  readonly optionsError = signal<string | null>(null);

  readonly creating = toSignal(this.store.select(selectCreating), {
    initialValue: false,
  });
  readonly serverError = toSignal(this.store.select(selectError), {
    initialValue: null as string | null,
  });

  form: FormGroup = this.fb.group({
    customerId: ['', [Validators.required]],
    serviceId: ['', [Validators.required]],
    notes: [''],
  });

  readonly startLabel = computed(() => {
    const d = this.date;
    const t = this.time;
    if (!d || !t) return '';
    return `${d} ${t}`;
  });

  constructor() {
    effect(() => {
      if (this.openSignal()) {
        this.loadOptions();
        this.patchFormFromInputs();
      }
    });
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);
    this.optionsError.set(null);
    lastValueFrom(
      forkJoin({
        customers: this.api.get<CustomerOption[]>('customers'),
        services: this.api.get<ServiceOption[]>('services'),
      })
    )
      .then(({ customers, services }) => {
        this.customers.set(customers ?? []);
        this.services.set(services ?? []);
      })
      .catch((err: unknown) => {
        this.optionsError.set(
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to load options'
        );
      })
      .finally(() => this.loadingOptions.set(false));
  }

  private patchFormFromInputs(): void {
    const d = this.date;
    const t = this.time;
    if (!d || !t) return;
    const startStr = `${d}T${t}`;
    const startDate = new Date(startStr);
    if (isNaN(startDate.getTime())) return;
    const endDate = new Date(
      startDate.getTime() +
        DEFAULT_APPOINTMENT_DURATION_MINUTES * 60 * 1000
    );
    this.form.patchValue({
      customerId: '',
      serviceId: '',
      notes: '',
    });
  }

  close(): void {
    this.openSignal.set(false);
    this.closed.emit();
  }

  private pendingCreate = false;

  onSubmit(): void {
    if (this.form.invalid || this.creating() || this.pendingCreate) {
      this.form.markAllAsTouched();
      return;
    }
    const d = this.date;
    const t = this.time;
    if (!d || !t) return;
    const startStr = `${d}T${t}`;
    const startDate = new Date(startStr);
    if (isNaN(startDate.getTime())) return;
    const endDate = new Date(
      startDate.getTime() + DEFAULT_APPOINTMENT_DURATION_MINUTES * 60 * 1000
    );

    const dto: CreateAppointmentDto = {
      customerId: this.form.get('customerId')?.value?.trim() ?? '',
      serviceId: this.form.get('serviceId')?.value?.trim() ?? '',
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      time: t,
      date: d,
      notes: this.form.get('notes')?.value?.trim() || undefined,
    };
    this.pendingCreate = true;
    this.store.dispatch(AppointmentsActions.create({ dto }));
    this.actions
      .pipe(
        ofType(AppointmentsActions.createSuccess, AppointmentsActions.createFailure),
        take(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((action) => {
        this.pendingCreate = false;
        if (action.type === AppointmentsActions.createSuccess.type) {
          this.created.emit();
          this.close();
        }
      });
  }

  get customerId() {
    return this.form.get('customerId');
  }
  get serviceId() {
    return this.form.get('serviceId');
  }
}
