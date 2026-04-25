import {
  Component,
  inject,
  OnInit,
  computed,
  signal,
  DestroyRef,
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
import { readBusinessSlugFromPathFromRoot } from '../../utils/public-route-snapshot.util';

/** 3-step flow: 1=service, 2=date+time, 3=confirm */
type BookStep = 1 | 2 | 3;

const STEP_TITLES: Record<BookStep, string> = {
  1: 'בחרי שירות',
  2: 'תאריך ושעה',
  3: 'אישור התור',
};

const STEP_NAV_LABELS: Record<BookStep, string> = {
  1: 'שירות',
  2: 'תאריך ושעה',
  3: 'אישור',
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
    ButtonModule,
    DatePickerModule,
    HoldToConfirmButtonComponent,
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly doc = inject(DOCUMENT);

  /** Latest-wins slot loads: each new emission cancels the previous HTTP call. */
  private readonly loadSlotsTrigger = new Subject<{
    businessId: string;
    serviceId: string;
    dateStr: string;
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
  /** Guest-only: customer full name. */
  readonly guestName = signal('');
  /** Guest-only: customer phone (optional). */
  readonly guestPhone = signal('');

  // ── Loading / error signals ────────────────────────────────────────────────
  readonly loadingBusiness = signal(true);
  readonly loadingServices = signal(true);
  readonly loadingSlots = signal(false);
  readonly slotsError = signal(false);
  /** Inline copy for slot load failures (toast not used here to avoid duplicate surfaces). */
  readonly slotsErrorDetail = signal<string | null>(null);
  readonly submitting = signal(false);

  // ── Step navigation ────────────────────────────────────────────────────────
  readonly currentStep = signal<BookStep>(1);
  /**
   * Toggled off then on after a non-fatal booking error to destroy and
   * recreate the hold-to-confirm component so the progress ring resets.
   */
  readonly showHoldButton = signal(true);

  // ── Progress indicator data ─────────────────────────────────────────────────
  readonly bookSteps: readonly BookStep[] = [1, 2, 3];
  readonly stepNavLabels = STEP_NAV_LABELS;

  // ── Route ─────────────────────────────────────────────────────────────────
  readonly slug = computed(() => readBusinessSlugFromPathFromRoot(this.route));

  // ── Derived computeds ─────────────────────────────────────────────────────
  readonly minDate = this.minDateForCalendar.asReadonly();
  readonly isLoggedIn = computed(() => this.session.hasSessionFor(this.slug()));

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

  readonly stepTitle = computed(() => STEP_TITLES[this.currentStep()]);
  readonly progressPercent = computed(() => (this.currentStep() / 3) * 100);

  /** Used only for the hold-to-confirm disabled state on step 3. */
  readonly canConfirm = computed(
    () =>
      !this.submitting() &&
      (this.isLoggedIn() || this.guestName().trim().length > 0)
  );

  // ── Two-way binding shim for p-datePicker [(ngModel)] ──────────────────────
  get selectedDateValue(): Date | null {
    return this.selectedDate();
  }
  set selectedDateValue(v: Date | null) {
    this.selectedDate.set(v);
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
              params.dateStr
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
    } else {
      this.currentStep.set((step - 1) as BookStep);
    }
  }

  // ── Selection handlers — auto-advance ──────────────────────────────────────

  selectService(svc: PublicService): void {
    if (this.selectedService()?.id !== svc.id) {
      // Clear downstream state when service changes.
      this.selectedDate.set(null);
      this.slots.set([]);
      this.selectedSlot.set(null);
      this.slotsError.set(false);
      this.slotsErrorDetail.set(null);
    }
    this.selectedService.set(svc);
    // Brief pause so the card selection animation is visible, then advance.
    setTimeout(() => this.currentStep.set(2), 320);
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
    this.selectedSlot.set(slot);
    // Brief pause so the pill selection animation is visible, then advance.
    setTimeout(() => this.currentStep.set(3), 320);
  }

  // ── Step-2 helpers ─────────────────────────────────────────────────────────

  retryLoadSlots(): void {
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
    const loggedIn = this.isLoggedIn();
    const name = this.guestName().trim();

    if (!b || !svc || !dateStr || !time) return;
    if (!loggedIn && !name) return;

    this.submitting.set(true);

    const body = buildPublicCreateAppointmentBody({
      businessId: b.id,
      serviceId: svc.id,
      date: dateStr,
      time,
      customerName: !loggedIn ? name : undefined,
      customerPhone: !loggedIn ? this.guestPhone() : undefined,
    });

    this.publicApi.createAppointment(body).subscribe({
      next: (res) => {
        this.submitting.set(false);
        const slug = this.slug();
        if (slug) {
          this.router.navigate(['/b', slug], {
            state: {
              booked: true,
              customerId: this.session.customerId(),
              apt: {
                id: res.id,
                date: dateStr,
                time,
                status: res.status,
                serviceName: svc.nameHe,
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
          this.currentStep.set(2);
          const b2 = this.business();
          const svc2 = this.selectedService();
          if (b2 && svc2 && dateStr) {
            this.loadSlots(b2.id, svc2.id, dateStr);
          }
        } else {
          this.showError(friendlyPublicBookingError(err));
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

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Pre-select service when opening e.g. `/b/:slug/book?service=:id` from the landing page. */
  private applyPresetServiceFromQuery(services: PublicService[]): void {
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
        this.loadingBusiness.set(false);
      },
      error: (err) => {
        this.loadingBusiness.set(false);
        this.showError(err?.error?.message ?? 'שגיאה בטעינת העסק');
      },
    });
  }

  private loadServices(slug: string): void {
    this.loadingServices.set(true);
    this.publicApi.getServices(slug).subscribe({
      next: (data) => {
        this.services.set(data);
        this.loadingServices.set(false);
        this.applyPresetServiceFromQuery(data);
      },
      error: (err) => {
        this.loadingServices.set(false);
        this.showError(err?.error?.message ?? 'שגיאה בטעינת השירותים');
      },
    });
  }

  private loadSlots(businessId: string, serviceId: string, dateStr: string): void {
    this.loadSlotsTrigger.next({ businessId, serviceId, dateStr });
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
      this.showError('ההתחברות פגה, יש להתחבר מחדש');
      void this.router.navigate(['/b', slug, 'login']);
    }
    return true;
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
