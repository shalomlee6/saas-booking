import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin, finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { AutoCompleteModule } from 'primeng/autocomplete';
import type { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { CustomersApiService } from '../../../customers/services/customers-api.service';
import { ServicesApiService } from '../../../services/services/services-api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import type { Customer } from '../../../customers/model/customer';
import type { Service } from '../../../services/model/service';
import {
  businessWallTimeToUtc,
  toDateKey,
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
} from '../../utils/calendar.utils';
import { friendlyOwnerAppointmentError } from '../../../../shared/utils/http-field-errors.util';

const STATUS_OPTIONS: { label: string; value: 'confirmed' | 'pending' }[] = [
  { label: 'מאושר', value: 'confirmed' },
  { label: 'ממתין', value: 'pending' },
];

@Component({
  selector: 'app-appointment-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DatePickerModule,
    InputNumberModule,
    SelectModule,
    TextareaModule,
    AutoCompleteModule,
  ],
  templateUrl: './appointment-form.component.html',
  styleUrl: './appointment-form.component.scss',
})
export class AppointmentFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsApi = inject(AppointmentsApiService);
  private readonly customersApi = inject(CustomersApiService);
  private readonly servicesApi = inject(ServicesApiService);
  private readonly auth = inject(AuthService);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly allCustomers = signal<Customer[]>([]);
  readonly filteredCustomers = signal<Customer[]>([]);
  readonly services = signal<Service[]>([]);
  readonly statusOptions = STATUS_OPTIONS;

  readonly form: FormGroup = this.fb.group({
    customer: [null as Customer | null, Validators.required],
    serviceId: ['', Validators.required],
    date: [null as Date | null, Validators.required],
    startTime: [null as Date | null, Validators.required],
    endTime: [null as Date | null, Validators.required],
    price: [null as number | null],
    status: ['confirmed' as 'confirmed' | 'pending', Validators.required],
    notes: [''],
  });

  get minDate(): Date {
    const tz = this.auth.businessTimezone();
    const key = toDateKey(new Date(), tz);
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }

  ngOnInit(): void {
    forkJoin({
      customers: this.customersApi.getList(),
      services: this.servicesApi.list(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ customers, services }) => {
          const normalized = customers.map((c) => ({
            ...c,
            fullName: c.fullName ?? c.name,
          }));
          this.allCustomers.set(normalized);
          this.filteredCustomers.set(normalized);
          this.services.set(services);
          this.applyQueryPrefill();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: 'לא ניתן לטעון לקוחות או שירותים',
          });
        },
      });
  }

  private applyQueryPrefill(): void {
    const params = this.route.snapshot.queryParamMap;
    const date = params.get('date');
    const time = params.get('time');
    if (!date || !time) return;
    const [y, mo, d] = date.split('-').map(Number);
    if (!y || !mo || !d) return;
    const dateField = new Date(y, mo - 1, d);
    const timeParts = time.split(':');
    const th = Number(timeParts[0]);
    const tm = Number(timeParts[1] ?? '0');
    if (!Number.isFinite(th)) return;
    const startTime = new Date(y, mo - 1, d, th, Number.isFinite(tm) ? tm : 0, 0, 0);
    const endTime = new Date(
      startTime.getTime() + DEFAULT_APPOINTMENT_DURATION_MINUTES * 60 * 1000
    );
    this.form.patchValue({ date: dateField, startTime, endTime });
  }

  displayCustomer(c: Customer): string {
    if (!c) return '';
    const name = c.fullName ?? c.name;
    return c.phone ? `${name} · ${c.phone}` : name;
  }

  filterCustomers(event: AutoCompleteCompleteEvent): void {
    const q = (event.query ?? '').trim().toLowerCase();
    const all = this.allCustomers();
    if (!q) {
      this.filteredCustomers.set([...all]);
      return;
    }
    this.filteredCustomers.set(
      all.filter(
        (c) =>
          (c.fullName ?? c.name).toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q)
      )
    );
  }

  onCustomerDropdownClick(): void {
    this.filteredCustomers.set([...this.allCustomers()]);
  }

  onServiceChange(): void {
    const sid = this.form.get('serviceId')?.value as string;
    if (!sid) return;
    const svc = this.services().find((s) => s._id === sid);
    if (!svc) return;
    const st = this.form.get('startTime')?.value as Date | null;
    if (!(st instanceof Date) || isNaN(st.getTime())) {
      this.form.patchValue({ price: svc.price ?? null });
      return;
    }
    const dur = svc.durationMinutes ?? 30;
    const end = new Date(st.getTime() + dur * 60 * 1000);
    this.form.patchValue({
      endTime: end,
      price: svc.price ?? null,
    });
  }

  onStartTimeChange(): void {
    this.onServiceChange();
  }

  cancel(): void {
    void this.router.navigate(['/appointments']);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const tz = this.auth.businessTimezone();
    const v = this.form.getRawValue() as {
      customer: Customer;
      serviceId: string;
      date: Date;
      startTime: Date;
      endTime: Date;
      price: number | null;
      status: 'confirmed' | 'pending';
      notes: string;
    };

    const dateKey = toDateKey(v.date, tz);
    const sh = v.startTime.getHours();
    const sm = v.startTime.getMinutes();
    const eh = v.endTime.getHours();
    const em = v.endTime.getMinutes();
    const startStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
    const endStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

    const startUtc = businessWallTimeToUtc(dateKey, startStr, tz);
    const endUtc = businessWallTimeToUtc(dateKey, endStr, tz);
    if (!startUtc || !endUtc) {
      this.messageService.add({
        severity: 'error',
        summary: 'שגיאה',
        detail: 'תאריך או שעה לא תקינים',
      });
      return;
    }

    this.saving.set(true);
    this.appointmentsApi
      .create({
        customerId: v.customer._id,
        serviceId: v.serviceId,
        startTime: startUtc.toISOString(),
        endTime: endUtc.toISOString(),
        price: v.price ?? undefined,
        status: v.status,
        notes: v.notes?.trim() || undefined,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: '',
            detail: 'התור נוצר בהצלחה',
          });
          this.appointmentsApi.refresh();
          void this.router.navigate(['/appointments']);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: friendlyOwnerAppointmentError(err),
          });
        },
      });
  }
}
