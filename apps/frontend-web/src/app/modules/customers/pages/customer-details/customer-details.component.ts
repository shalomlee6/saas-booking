import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomersApiService } from '../../services/customers-api.service';
import { CustomerServiceConfigApiService } from '../../services/customer-service-config-api.service';
import { ServicesApiService } from '../../../services/services/services-api.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import type { Customer, TimeOfDayBucket } from '../../model/customer';
import type {
  CustomerAppointmentHistoryItem,
  CustomerInsight,
  CustomerStats,
} from '../../model/customer-card';
import type { CustomerServiceConfig } from '../../model/customer-service-config';
import type { Service } from '../../../services/model/service';

const TIME_OF_DAY_KEYS: Record<TimeOfDayBucket, string> = {
  morning: 'timeOfDay.morning',
  afternoon: 'timeOfDay.afternoon',
  evening: 'timeOfDay.evening',
  night: 'timeOfDay.night',
};

/** 'done' is a legacy status value some records still carry — treated the same as 'completed'. */
const STATUS_KEYS: Record<string, string> = {
  pending: 'status.pending',
  confirmed: 'status.confirmed',
  completed: 'status.completed',
  done: 'status.completed',
  cancelled: 'status.cancelled',
  canceled: 'status.cancelled',
};

@Component({
  selector: 'app-customer-details',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, CurrencyPipe, TranslatePipe],
  templateUrl: './customer-details.component.html',
  styleUrl: './customer-details.component.scss',
})
export class CustomerDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly customersApi = inject(CustomersApiService);
  private readonly configApi = inject(CustomerServiceConfigApiService);
  private readonly servicesApi = inject(ServicesApiService);
  readonly language = inject(LanguageService);

  private readonly customerId = this.route.snapshot.paramMap.get('id')!;

  readonly timeOfDayOptions: { value: TimeOfDayBucket; label: string }[] = (
    ['morning', 'afternoon', 'evening', 'night'] as const
  ).map((value) => ({ value, label: this.language.t(TIME_OF_DAY_KEYS[value]) }));

  timeOfDayLabel(bucket: TimeOfDayBucket | null | undefined): string {
    return bucket ? this.language.t(TIME_OF_DAY_KEYS[bucket] ?? '') || bucket : '—';
  }

  statusLabel(status: string | undefined): string {
    const key = (status ?? '').toLowerCase();
    const translationKey = STATUS_KEYS[key];
    return translationKey ? this.language.t(translationKey) : status ?? '—';
  }

  /** Rule-based insight text — excludes NEW_CUSTOMER, which gets its own dedicated empty-state UI. */
  insightText(insight: CustomerInsight): string {
    const d = insight.data;
    switch (insight.code) {
      case 'RETURNS_PERIODICALLY':
        return this.language.t('customerCard.insightReturnsPeriodically', {
          weeks: d['weeks'],
          days: d['days'],
        });
      case 'DUE_FOR_REBOOKING':
        return this.language.t('customerCard.insightDueForRebooking', {
          daysSinceLast: d['daysSinceLast'],
          avgIntervalDays: d['avgIntervalDays'],
        });
      case 'FREQUENT_CANCELLATIONS':
        return this.language.t('customerCard.insightFrequentCancellations', {
          count: d['count'],
          windowDays: d['windowDays'],
        });
      case 'HAS_UPCOMING_NO_SHOW_RISK':
        return this.language.t('customerCard.insightNoShowRisk');
      default:
        return '';
    }
  }

  /** Rule-based insight banners, excluding NEW_CUSTOMER — that one gets its own dedicated empty-state card. */
  readonly bannerInsights = computed(() => this.insights().filter((i) => i.code !== 'NEW_CUSTOMER'));

  // ─── Customer profile ───────────────────────────────────────────────────
  readonly customer = signal<Customer | null>(null);
  readonly loadingCustomer = signal(true);
  readonly customerError = signal<string | null>(null);

  readonly editingProfile = signal(false);
  readonly savingProfile = signal(false);
  readonly profileForm = this.fb.group({
    notes: [''],
    preferredTimeOfDay: [''],
    allergies: [''],
    tags: [''],
  });

  // ─── Stats / insights ────────────────────────────────────────────────────
  readonly stats = signal<CustomerStats | null>(null);
  readonly insights = signal<CustomerInsight[]>([]);
  readonly loadingStats = signal(true);

  // ─── Appointment history ─────────────────────────────────────────────────
  readonly history = signal<CustomerAppointmentHistoryItem[]>([]);
  readonly loadingHistory = signal(true);
  /** Single history card toggles between these instead of showing two separate cards. */
  readonly historyTab = signal<'upcoming' | 'past'>('upcoming');

  readonly upcomingAppointments = computed(() => {
    const now = Date.now();
    return this.history()
      .filter((a) => new Date(a.start).getTime() > now && a.status !== 'cancelled')
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  });

  readonly pastAppointments = computed(() => {
    const now = Date.now();
    return this.history().filter(
      (a) => new Date(a.start).getTime() <= now || a.status === 'cancelled'
    );
  });

  // ─── Service-specific overrides ──────────────────────────────────────────
  readonly serviceConfigs = signal<CustomerServiceConfig[]>([]);
  readonly loadingConfigs = signal(true);
  readonly services = signal<Service[]>([]);

  readonly serviceNameMap = computed(() => new Map(this.services().map((s) => [s._id, s])));

  readonly showOverrideForm = signal(false);
  readonly editingConfigId = signal<string | null>(null);
  readonly savingOverride = signal(false);
  readonly overrideFormError = signal<string | null>(null);
  readonly overrideForm = this.fb.group({
    serviceId: ['', [Validators.required]],
    durationOverrideMinutes: [''],
    priceOverride: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.loadCustomer();
    this.loadStats();
    this.loadHistory();
    this.loadServiceConfigs();
    this.loadServices();
  }

  private loadCustomer(): void {
    this.loadingCustomer.set(true);
    this.customersApi.getById(this.customerId).subscribe({
      next: (customer) => {
        this.customer.set(customer);
        this.loadingCustomer.set(false);
        this.resetProfileForm(customer);
      },
      error: () => {
        this.customerError.set(this.language.t('customerCard.loadError'));
        this.loadingCustomer.set(false);
      },
    });
  }

  private loadStats(): void {
    this.loadingStats.set(true);
    this.customersApi.getCardStats(this.customerId).subscribe({
      next: ({ stats, insights }) => {
        this.stats.set(stats);
        this.insights.set(insights);
        this.loadingStats.set(false);
      },
      error: () => this.loadingStats.set(false),
    });
  }

  private loadHistory(): void {
    this.loadingHistory.set(true);
    this.customersApi.getAppointmentHistory(this.customerId).subscribe({
      next: (history) => {
        this.history.set(history);
        this.loadingHistory.set(false);
      },
      error: () => this.loadingHistory.set(false),
    });
  }

  private loadServiceConfigs(): void {
    this.loadingConfigs.set(true);
    this.configApi.listForCustomer(this.customerId).subscribe({
      next: (configs) => {
        this.serviceConfigs.set(configs);
        this.loadingConfigs.set(false);
      },
      error: () => this.loadingConfigs.set(false),
    });
  }

  private loadServices(): void {
    this.servicesApi.list().subscribe({
      next: (services) => this.services.set(services),
      error: () => {
        /* Service picker just stays empty; overrides list still renders with raw ids. */
      },
    });
  }

  // ─── Profile editing ─────────────────────────────────────────────────────

  private resetProfileForm(customer: Customer): void {
    this.profileForm.reset({
      notes: customer.notes ?? '',
      preferredTimeOfDay: customer.preferences?.preferredTimeOfDay ?? '',
      allergies: customer.preferences?.allergies ?? '',
      tags: (customer.preferences?.tags ?? []).join(', '),
    });
  }

  startEditProfile(): void {
    const customer = this.customer();
    if (customer) this.resetProfileForm(customer);
    this.editingProfile.set(true);
  }

  cancelEditProfile(): void {
    const customer = this.customer();
    if (customer) this.resetProfileForm(customer);
    this.editingProfile.set(false);
  }

  saveProfile(): void {
    if (this.savingProfile()) return;
    const raw = this.profileForm.getRawValue();
    const tags = raw.tags
      ? raw.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    this.savingProfile.set(true);
    this.customersApi
      .update(this.customerId, {
        notes: raw.notes?.trim() || undefined,
        preferences: {
          preferredTimeOfDay: (raw.preferredTimeOfDay || undefined) as TimeOfDayBucket | undefined,
          allergies: raw.allergies?.trim() || undefined,
          tags,
        },
      })
      .subscribe({
        next: (customer) => {
          this.customer.set(customer);
          this.savingProfile.set(false);
          this.editingProfile.set(false);
        },
        error: () => {
          this.savingProfile.set(false);
        },
      });
  }

  // ─── Service overrides ───────────────────────────────────────────────────

  startAddOverride(): void {
    this.editingConfigId.set(null);
    this.overrideFormError.set(null);
    this.overrideForm.reset({ serviceId: '', durationOverrideMinutes: '', priceOverride: '', notes: '' });
    this.overrideForm.get('serviceId')?.enable();
    this.showOverrideForm.set(true);
  }

  startEditOverride(config: CustomerServiceConfig): void {
    this.editingConfigId.set(config._id);
    this.overrideFormError.set(null);
    this.overrideForm.reset({
      serviceId: config.serviceId,
      durationOverrideMinutes: config.durationOverrideMinutes?.toString() ?? '',
      priceOverride: config.priceOverride?.toString() ?? '',
      notes: config.notes ?? '',
    });
    // The service on an existing override can't be changed (PUT doesn't accept it) — delete + re-add instead.
    this.overrideForm.get('serviceId')?.disable();
    this.showOverrideForm.set(true);
  }

  cancelOverrideForm(): void {
    this.showOverrideForm.set(false);
    this.editingConfigId.set(null);
    this.overrideFormError.set(null);
  }

  submitOverrideForm(): void {
    if (this.overrideForm.invalid || this.savingOverride()) {
      this.overrideForm.markAllAsTouched();
      return;
    }
    const raw = this.overrideForm.getRawValue();
    const durationOverrideMinutes = raw.durationOverrideMinutes
      ? Number(raw.durationOverrideMinutes)
      : undefined;
    const priceOverride = raw.priceOverride ? Number(raw.priceOverride) : undefined;
    const notes = raw.notes?.trim() || undefined;

    this.savingOverride.set(true);
    this.overrideFormError.set(null);

    const editingId = this.editingConfigId();
    const request = editingId
      ? this.configApi.update(editingId, { durationOverrideMinutes, priceOverride, notes })
      : this.configApi.create({
          customerId: this.customerId,
          serviceId: raw.serviceId!,
          durationOverrideMinutes,
          priceOverride,
          notes,
        });

    request.subscribe({
      next: () => {
        this.savingOverride.set(false);
        this.showOverrideForm.set(false);
        this.editingConfigId.set(null);
        this.loadServiceConfigs();
      },
      error: () => {
        this.savingOverride.set(false);
        this.overrideFormError.set(this.language.t('customerCard.overrideSaveError'));
      },
    });
  }

  formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat(this.language.intlLocale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  }

  formatDateTime(date: string | Date): string {
    return new Intl.DateTimeFormat(this.language.intlLocale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  deleteOverride(config: CustomerServiceConfig): void {
    const serviceName = this.serviceNameMap().get(config.serviceId)?.name ?? this.language.t('common.service');
    if (!confirm(this.language.t('customerCard.removeOverrideConfirm', { service: serviceName }))) return;
    this.configApi.delete(config._id).subscribe({
      next: () => this.loadServiceConfigs(),
    });
  }
}
