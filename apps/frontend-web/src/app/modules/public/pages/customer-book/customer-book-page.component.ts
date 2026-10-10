import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, EMPTY, fromEvent, interval, filter, switchMap, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  PublicApiService,
  type PublicBusinessForBooking,
  type PublicService,
} from '../../services/public-api.service';
import { PublicSessionService } from '../../services/public-session.service';
import { HoldToConfirmButtonComponent } from './hold-to-confirm-button.component';
import { PublicIdentifyComponent } from '../../components/public-identify/public-identify.component';
import {
  formatParsedErrorForUi,
  friendlyPublicBookingError,
  parseHttpClientError,
} from '../../../../shared/utils/http-field-errors.util';
import {
  buildPublicCreateAppointmentBody,
  toDateKeyInBusinessTimezone,
} from '../../dto/public-booking-dto.adapter';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { readBusinessSlugFromPathFromRoot } from '../../utils/public-route-snapshot.util';

/** 1 service, 2 identify, 3 date/time, 4 confirm. Identify is skipped for a known device. */
type BookStep = 1 | 2 | 3 | 4;

const STEP_TITLE_KEYS: Record<BookStep, string> = {
  1: 'publicBook.serviceTitle',
  2: 'publicBook.identifyTitle',
  3: 'publicBook.dateTitle',
  4: 'publicBook.confirmTitle',
};

const STEP_NAV_KEYS: Record<BookStep, string> = {
  1: 'publicBook.serviceNav',
  2: 'publicBook.identifyNav',
  3: 'publicBook.dateNav',
  4: 'publicBook.confirmNav',
};

/** Local calendar day at 00:00 — used for minDate and midnight refresh. */
function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

@Component({
  selector: 'app-customer-book-page',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DatePickerModule,
    HoldToConfirmButtonComponent,
    PublicIdentifyComponent,
    SkeletonModule,
  ],
  templateUrl: './customer-book-page.component.html',
  styleUrl: './customer-book-page.component.scss',
})
export class CustomerBookPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicApi = inject(PublicApiService);
  private readonly messageService = inject(MessageService);
  private readonly session = inject(PublicSessionService);
  private readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly doc = inject(DOCUMENT);

  /** Latest-wins slot loads: each new emission cancels the previous HTTP call. */
  private readonly loadSlotsTrigger = new Subject<{
    businessId: string;
    serviceId: string;
    dateStr: string;
    excludeAppointmentId?: string;
  }>();

  /** Refreshed on visibility, timer, and init so “today” advances after midnight. */
  private readonly minDateForCalendar = signal<Date>(startOfDay(new Date()));

  // ── Data signals ───────────────────────────────────────────────────────────
  readonly business = signal<PublicBusinessForBooking | null>(null);
  readonly services = signal<PublicService[]>([]);
  readonly selectedService = signal<PublicService | null>(null);
  readonly selectedDate = signal<Date | null>(null);
  readonly slots = signal<string[]>([]);
  readonly selectedSlot = signal<string | null>(null);
  readonly offer = signal<{ durationMinutes: number; price: number } | null>(null);
  readonly skippedIdentify = signal(false);
  readonly rescheduleId = signal<string | null>(null);
  readonly rescheduleFrom = signal<{ date: string; time: string } | null>(null);
  readonly identifyEntry = signal<'phone' | 'birthday' | 'profile'>('phone');
  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');

  // ── Loading / error signals ────────────────────────────────────────────────
  readonly loadingBusiness = signal(true);
  readonly loadingServices = signal(true);
  readonly loadingSlots = signal(false);
  readonly slotsError = signal(false);
  /** Inline copy for slot load failures (toast not used here to avoid duplicate surfaces). */
  readonly slotsErrorDetail = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly step1LoadError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);

  // ── Step navigation ────────────────────────────────────────────────────────
  readonly currentStep = signal<BookStep>(1);
  /**
   * Toggled off then on after a non-fatal booking error to destroy and
   * recreate the hold-to-confirm component so the progress ring resets.
   */
  readonly showHoldButton = signal(true);

  // ── Progress indicator data ─────────────────────────────────────────────────
  readonly bookSteps: readonly BookStep[] = [1, 2, 3, 4];
  readonly stepNavKeys = STEP_NAV_KEYS;

  // ── Route ─────────────────────────────────────────────────────────────────
  readonly slug = computed(() => readBusinessSlugFromPathFromRoot(this.route));

  // ── Derived computeds ─────────────────────────────────────────────────────
  readonly minDate = this.minDateForCalendar.asReadonly();
  readonly isLoggedIn = computed(() => this.session.readyToBook(this.slug()));

  readonly loadingStep1 = computed(
    () => this.loadingBusiness() || this.loadingServices()
  );

  readonly selectedDateStr = computed(() => {
    const d = this.selectedDate();
    if (!d) return '';
    const tz =
      this.business()?.localization?.timezone ?? this.auth.businessTimezone();
    return toDateKeyInBusinessTimezone(d, tz);
  });

  readonly formattedBookingDate = computed(() => {
    const d = this.selectedDate();
    if (!d) return '';
    return d.toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  });

  readonly rescheduleMove = computed(() => {
    const from = this.rescheduleFrom();
    const toDate = this.formattedBookingDate();
    const toTime = this.selectedSlot();
    if (!this.rescheduleId() || !from || !toDate || !toTime) return null;
    return {
      from: `${this.formatVisitDate(from.date)} ${from.time}`,
      to: `${toDate} ${toTime}`,
    };
  });

  readonly stepTitle = computed(() => this.language.t(STEP_TITLE_KEYS[this.currentStep()]));
  readonly progressPercent = computed(() => (this.currentStep() / 4) * 100);
  readonly canConfirm = computed(() => !this.submitting());

  // ── Two-way binding shim for p-datePicker [(ngModel)] ──────────────────────
  get selectedDateValue(): Date | null {
    return this.selectedDate();
  }
  set selectedDateValue(v: Date | null) {
    this.selectedDate.set(v);
  }

  constructor() {
    effect(() => {
      this.currentStep();
      untracked(() => queueMicrotask(() => this.stepHeading()?.nativeElement.focus()));
    });
    effect(() => {
      const epoch = this.session.flowEpoch();
      if (epoch === 0) return;
      untracked(() => this.resetToStart());
    });
  }

  ngOnInit(): void {
    this.wireSlotsLoadPipeline();
    this.wireMinDateRefresh();

    const slug = this.slug();
    if (!slug) {
      this.loadingBusiness.set(false);
      this.loadingServices.set(false);
      this.showError('חסר מזהה עסק');
      return;
    }
    this.loadBusiness(slug);
    this.loadServices(slug);
  }

  /**
   * Cancels in-flight availability requests when the user picks another date
   * (switchMap); only the latest response updates the UI.
   */
  private wireSlotsLoadPipeline(): void {
    this.loadSlotsTrigger
      .pipe(
        switchMap((params) => {
          this.loadingSlots.set(true);
          this.slotsError.set(false);
          this.slotsErrorDetail.set(null);
          return this.publicApi
            .getAvailabilityByBusinessId(
              params.businessId,
              params.serviceId,
              params.dateStr,
              params.excludeAppointmentId
            )
            .pipe(
              catchError((err: unknown) => {
                if (this.handleUnauthorizedPublicSession(err)) {
                  this.loadingSlots.set(false);
                  return EMPTY;
                }
                this.loadingSlots.set(false);
                this.slotsError.set(true);
                this.slotsErrorDetail.set(
                  formatParsedErrorForUi(parseHttpClientError(err)) ??
                    'שגיאה בטעינת השעות'
                );
                return EMPTY;
              })
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => {
        this.slots.set(res.slots);
        if (typeof res.durationMinutes === 'number' && typeof res.price === 'number') {
          this.offer.set({ durationMinutes: res.durationMinutes, price: res.price });
        }
        this.selectedSlot.set(null);
        this.slotsErrorDetail.set(null);
        this.loadingSlots.set(false);
      });
  }

  /** Keeps calendar “today” correct across midnight and when returning to the tab. */
  private wireMinDateRefresh(): void {
    const bump = (): void => {
      this.minDateForCalendar.set(startOfDay(new Date()));
    };
    bump();
    fromEvent(this.doc, 'visibilitychange')
      .pipe(
        filter(() => this.doc.visibilityState === 'visible'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => bump());
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => bump());
  }


  // ── Step navigation ────────────────────────────────────────────────────────

  goStepBack(): void {
    const step = this.currentStep();
    if (step <= 1) {
      this.goToHome();
      return;
    }
    if (step === 3 && this.skippedIdentify()) {
      this.currentStep.set(1);
      return;
    }
    this.currentStep.set((step - 1) as BookStep);
  }

  // ── Selection handlers — auto-advance ──────────────────────────────────────

  selectService(svc: PublicService): void {
    this.submitError.set(null);
    if (this.selectedService()?.id !== svc.id) {
      // Clear downstream state when service changes.
      this.selectedDate.set(null);
      this.slots.set([]);
      this.selectedSlot.set(null);
      this.slotsError.set(false);
      this.slotsErrorDetail.set(null);
    }
    this.selectedService.set(svc);
    const slug = this.slug();
    if (!slug) return;
    this.publicApi.getSessionMe(slug).subscribe((result) => {
      if (result.kind === 'ok') {
        this.session.applyMe(slug, result.profile);
        if (this.session.readyToBook(slug)) {
          this.skippedIdentify.set(true);
          this.currentStep.set(3);
          return;
        }
        this.skippedIdentify.set(false);
        this.identifyEntry.set(result.profile.hasCustomer ? 'birthday' : 'profile');
        this.currentStep.set(2);
        return;
      }
      this.session.clearSession(slug);
      this.skippedIdentify.set(false);
      this.identifyEntry.set('phone');
      this.currentStep.set(2);
    });
  }

  onIdentified(): void {
    this.skippedIdentify.set(false);
    this.currentStep.set(3);
  }

  onDateSelect(): void {
    const b = this.business();
    const svc = this.selectedService();
    const dateStr = this.selectedDateStr();
    if (!b || !svc || !dateStr) return;
    // Load slots immediately so they're ready below the calendar.
    this.slots.set([]);
    this.selectedSlot.set(null);
    this.slotsError.set(false);
    this.slotsErrorDetail.set(null);
    this.loadSlots(b.id, svc.id, dateStr);
  }

  selectSlot(slot: string): void {
    this.submitError.set(null);
    this.selectedSlot.set(slot);
    // Brief pause so the pill selection animation is visible, then advance.
    setTimeout(() => this.currentStep.set(4), 320);
  }

  // ── Step-2 helpers ─────────────────────────────────────────────────────────

  retryLoadSlots(): void {
    this.submitError.set(null);
    const b = this.business();
    const svc = this.selectedService();
    const dateStr = this.selectedDateStr();
    if (b && svc && dateStr) {
      this.loadSlots(b.id, svc.id, dateStr);
    }
  }

  goToDateStep(): void {
    this.selectedDate.set(null);
    this.slots.set([]);
    this.selectedSlot.set(null);
    this.slotsError.set(false);
    this.slotsErrorDetail.set(null);
  }

  // ── Booking submission ─────────────────────────────────────────────────────

  confirmBooking(): void {
    const b = this.business();
    const svc = this.selectedService();
    const dateStr = this.selectedDateStr();
    const time = this.selectedSlot();
    if (!b || !svc || !dateStr || !time) return;

    this.submitting.set(true);
    this.submitError.set(null);

    const body = buildPublicCreateAppointmentBody({
      businessId: b.id,
      serviceId: svc.id,
      date: dateStr,
      time,
    });
    const movingId = this.rescheduleId();
    const request = movingId
      ? this.publicApi.rescheduleAppointment(movingId, dateStr, time)
      : this.publicApi.createAppointment(body);

    request.subscribe({
      next: (res) => {
        this.submitting.set(false);
        const slug = this.slug();
        if (res.customerId) this.session.rememberCustomerId(res.customerId);
        if (slug) {
          this.router.navigate(['/b', slug], {
            state: {
              booked: true,
              customerId: res.customerId ?? this.session.customerId(),
              apt: {
                id: res.id,
                date: dateStr,
                time,
                status: res.status,
                serviceName: svc.nameHe,
                serviceId: svc.id,
              },
            },
          });
        }
      },
      error: (err) => {
        this.submitting.set(false);
        if (this.handleUnauthorizedPublicSession(err)) {
          return;
        }
        if (err?.status === 409 && err?.error?.code === 'SLOT_TAKEN') {
          this.messageService.add({
            severity: 'warn',
            summary: 'תפוס',
            detail: 'התור נתפס, בחרי שעה אחרת',
            life: 5000,
          });
          // Return to date+time step and refresh the slot grid.
          this.currentStep.set(3);
          const b2 = this.business();
          const svc2 = this.selectedService();
          if (b2 && svc2 && dateStr) {
            this.loadSlots(b2.id, svc2.id, dateStr);
          }
        } else if (err?.error?.code === 'ONLINE_BOOKING_UNAVAILABLE') {
          const msg = this.language.t('customers.onlineBookingUnavailable');
          this.submitError.set(msg);
          this.showError(msg);
          this.showHoldButton.set(false);
          setTimeout(() => this.showHoldButton.set(true), 50);
        } else {
          const msg = friendlyPublicBookingError(err);
          this.submitError.set(msg);
          this.showError(msg);
          // Destroy and recreate hold-to-confirm so the ring resets.
          this.showHoldButton.set(false);
          setTimeout(() => this.showHoldButton.set(true), 50);
        }
      },
    });
  }

  goToHome(): void {
    const slug = this.slug();
    if (slug) this.router.navigate(['/b', slug]);
  }

  retryInitialLoad(): void {
    const slug = this.slug();
    if (!slug) return;
    this.step1LoadError.set(null);
    this.loadBusiness(slug);
    this.loadServices(slug);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Pre-select service when opening e.g. `/b/:slug/book?service=:id` from the landing page. */
  private applyPresetServiceFromQuery(services: PublicService[]): void {
    const reschedule = this.route.snapshot.queryParamMap.get('reschedule');
    if (reschedule) {
      this.rescheduleId.set(reschedule);
      this.publicApi.getUpcomingAppointment().subscribe((res) => {
        const list = res.appointments ?? (res.appointment ? [res.appointment] : []);
        const match = list.find((row) => row.id === reschedule);
        if (match) this.rescheduleFrom.set({ date: match.date, time: match.time });
      });
    }
    const id = this.route.snapshot.queryParamMap.get('service');
    if (!id) return;
    const match = services.find((s) => s.id === id);
    if (match) {
      this.selectService(match);
    }
  }

  private loadBusiness(slug: string): void {
    this.loadingBusiness.set(true);
    this.publicApi.getBusinessForBooking(slug).subscribe({
      next: (data) => {
        this.business.set(data);
        this.step1LoadError.set(null);
        this.loadingBusiness.set(false);
      },
      error: (err) => {
        this.loadingBusiness.set(false);
        this.step1LoadError.set(err?.error?.message ?? 'שגיאה בטעינת העסק');
        this.showError(err?.error?.message ?? 'שגיאה בטעינת העסק');
      },
    });
  }

  private loadServices(slug: string): void {
    this.loadingServices.set(true);
    this.publicApi.getServices(slug).subscribe({
      next: (data) => {
        this.services.set(data);
        this.step1LoadError.set(null);
        this.loadingServices.set(false);
        this.applyPresetServiceFromQuery(data);
      },
      error: (err) => {
        this.loadingServices.set(false);
        this.step1LoadError.set(err?.error?.message ?? 'שגיאה בטעינת השירותים');
        this.showError(err?.error?.message ?? 'שגיאה בטעינת השירותים');
      },
    });
  }

  private loadSlots(businessId: string, serviceId: string, dateStr: string): void {
    const excludeAppointmentId = this.rescheduleId() ?? undefined;
    this.loadSlotsTrigger.next({ businessId, serviceId, dateStr, excludeAppointmentId });
  }

  /**
   * Expired/invalid public customer token:
   * clear local session so UI immediately exits logged-in mode and re-auth.
   */
  private handleUnauthorizedPublicSession(err: unknown): boolean {
    const status =
      typeof err === 'object' && err && 'status' in err
        ? Number((err as { status?: unknown }).status)
        : 0;
    if (status !== 401) return false;
    const slug = this.slug();
    if (slug) {
      this.session.clearSession(slug);
      this.skippedIdentify.set(false);
      this.identifyEntry.set('phone');
      this.currentStep.set(2);
      this.showError(this.language.t('publicIdentity.genericError'));
    }
    return true;
  }

  private resetToStart(): void {
    this.currentStep.set(1);
    this.selectedService.set(null);
    this.selectedDate.set(null);
    this.selectedSlot.set(null);
    this.slots.set([]);
    this.offer.set(null);
    this.skippedIdentify.set(false);
    this.identifyEntry.set('phone');
    this.rescheduleId.set(null);
    this.rescheduleFrom.set(null);
    this.submitError.set(null);
  }

  private formatVisitDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    return new Date(year, month - 1, day).toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'שגיאה',
      detail: message,
      life: 5000,
    });
  }
}
