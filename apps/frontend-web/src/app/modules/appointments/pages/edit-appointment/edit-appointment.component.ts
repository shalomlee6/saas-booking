import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { CustomersApiService } from '../../../customers/services/customers-api.service';
import { ServicesApiService } from '../../../services/services/services-api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import type { Customer } from '../../../customers/model/customer';
import type { Service } from '../../../services/model/service';
import {
  getLocalParts,
  toDateKey,
  businessWallTimeToUtc,
} from '../../utils/calendar.utils';
import type { AppointmentDetailDto } from '../../services/appointments-api.service';

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'מאושר', value: 'confirmed' },
  { label: 'ממתין', value: 'pending' },
  { label: 'הושלם', value: 'completed' },
  { label: 'בוטל', value: 'cancelled' },
];

@Component({
  selector: 'app-edit-appointment',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DatePickerModule,
    InputNumberModule,
    SelectModule,
    TextareaModule,
    ProgressSpinnerModule,
    ToastModule,
  ],
  templateUrl: './edit-appointment.component.html',
  styleUrl: './edit-appointment.component.scss',
})
export class EditAppointmentComponent implements OnInit {
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
  readonly customers = signal<Customer[]>([]);
  readonly services = signal<Service[]>([]);
  readonly statusOptions = STATUS_OPTIONS;

  appointmentId = '';
  private detail: AppointmentDetailDto | null = null;

  readonly form: FormGroup = this.fb.group({
    customerId: ['', Validators.required],
    serviceId: ['', Validators.required],
    date: [null as Date | null, Validators.required],
    startTime: [null as Date | null, Validators.required],
    endTime: [null as Date | null, Validators.required],
    price: [null as number | null],
    status: ['confirmed', Validators.required],
    notes: [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/appointments']);
      return;
    }
    this.appointmentId = id;

    forkJoin({
      detail: this.appointmentsApi.getById(id),
      services: this.servicesApi.list(),
      customers: this.customersApi.getList(),
    })
      .pipe(
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: ({ detail, services, customers }) => {
          this.detail = detail;
          this.services.set(services);
          this.customers.set(customers);
          this.patchFormFromDetail(detail);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: 'לא ניתן לטעון את התור',
          });
          this.router.navigate(['/appointments']);
        },
      });
  }

  /** Build wall-clock date + time Date objects from ISO range in business TZ. */
  private patchFormFromDetail(d: AppointmentDetailDto): void {
    const tz = this.auth.businessTimezone();
    const start = new Date(d.start);
    const end = new Date(d.end);
    const dateKey = toDateKey(start, tz);
    const [y, mo, day] = dateKey.split('-').map(Number);
    const dateField = new Date(y, (mo ?? 1) - 1, day ?? 1);

    const sp = getLocalParts(start, tz);
    const ep = getLocalParts(end, tz);
    const base = new Date(y, (mo ?? 1) - 1, day ?? 1);
    const startTime = new Date(base);
    startTime.setHours(sp.hour, sp.minute, 0, 0);
    const endTime = new Date(base);
    endTime.setHours(ep.hour, ep.minute, 0, 0);

    this.form.patchValue({
      customerId: d.customerId ?? '',
      serviceId: d.serviceId,
      date: dateField,
      startTime,
      endTime,
      price: d.price ?? null,
      status: d.status,
      notes: d.notes ?? '',
    });
  }

  onServiceChange(): void {
    const sid = this.form.get('serviceId')?.value as string;
    if (!sid) return;
    const svc = this.services().find((s) => s._id === sid);
    if (!svc) return;
    const st = this.form.get('startTime')?.value as Date | null;
    if (!(st instanceof Date) || isNaN(st.getTime())) return;
    const dur = svc.durationMinutes ?? 30;
    const end = new Date(st.getTime() + dur * 60 * 1000);
    this.form.patchValue({ endTime: end, price: svc.price ?? this.form.get('price')?.value });
  }

  onStartTimeChange(): void {
    this.onServiceChange();
  }

  cancel(): void {
    this.router.navigate(['/appointments']);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const tz = this.auth.businessTimezone();
    const v = this.form.getRawValue() as {
      customerId: string;
      serviceId: string;
      date: Date;
      startTime: Date;
      endTime: Date;
      price: number | null;
      status: string;
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
    if (startUtc.getTime() >= endUtc.getTime()) {
      this.messageService.add({
        severity: 'error',
        summary: 'שגיאה',
        detail: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
      });
      return;
    }

    this.saving.set(true);
    this.appointmentsApi
      .patchAppointment(this.appointmentId, {
        customerId: v.customerId,
        serviceId: v.serviceId,
        start: startUtc.toISOString(),
        end: endUtc.toISOString(),
        price: v.price ?? undefined,
        status: v.status,
        notes: v.notes?.trim() || '',
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'נשמר',
            detail: 'התור עודכן בהצלחה',
          });
          this.router.navigate(['/appointments']);
        },
        error: (err) => {
          const msg =
            err?.error?.message ??
            err?.message ??
            'עדכון התור נכשל';
          this.messageService.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: typeof msg === 'string' ? msg : 'עדכון נכשל',
          });
        },
      });
  }
}
