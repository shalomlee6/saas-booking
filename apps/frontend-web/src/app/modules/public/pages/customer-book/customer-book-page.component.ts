import {
  Component,
  inject,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SkeletonModule } from 'primeng/skeleton';
import {
  PublicApiService,
  type PublicBusinessForBooking,
  type PublicService,
  type CreateAppointmentBody,
} from '../../services/public-api.service';
import { PublicSessionService } from '../../services/public-session.service';
import { HoldToConfirmButtonComponent } from './hold-to-confirm-button.component';

/** Steps: 1=service, 2=date, 3=time, 4=confirm */
type BookStep = 1 | 2 | 3 | 4;

const STEP_TITLES: Record<BookStep, string> = {
  1: 'בחירת שירות',
  2: 'בחירת תאריך',
  3: 'בחירת שעה',
  4: 'אישור התור',
};

const CTA_LABELS: Record<BookStep, string> = {
  1: 'המשך',
  2: 'המשך',
  3: 'המשך לאישור',
  4: 'קביעת תור',
};

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
  readonly submitting = signal(false);

  // ── Step navigation ────────────────────────────────────────────────────────
  readonly currentStep = signal<BookStep>(1);
  /**
   * Toggled off then on after a non-fatal booking error to destroy and
   * recreate the hold-to-confirm component so the progress ring resets.
   */
  readonly showHoldButton = signal(true);
  readonly stepNumbers = [1, 2, 3, 4] as const;

  // ── Route ─────────────────────────────────────────────────────────────────
  readonly slug = computed(() =>
    this.route.parent?.parent?.snapshot.paramMap.get('slug') ?? ''
  );

  // ── Derived computeds ─────────────────────────────────────────────────────
  readonly minDate = computed(() => new Date());
  readonly isLoggedIn = computed(() => this.session.hasSessionFor(this.slug()));

  readonly loadingStep1 = computed(
    () => this.loadingBusiness() || this.loadingServices()
  );

  readonly selectedDateStr = computed(() => {
    const d = this.selectedDate();
    if (!d) return '';
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  });

  readonly formattedBookingDate = computed(() => {
    const d = this.selectedDate();
    if (!d) return '';
    return d.toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  readonly stepTitle = computed(() => STEP_TITLES[this.currentStep()]);
  readonly ctaLabel = computed(() => CTA_LABELS[this.currentStep()]);
  readonly progressPercent = computed(() => (this.currentStep() / 4) * 100);

  readonly canGoNext = computed(() => {
    switch (this.currentStep()) {
      case 1: return this.selectedService() !== null;
      case 2: return this.selectedDate() !== null;
      case 3: return this.selectedSlot() !== null;
      case 4:
        return (
          !this.submitting() &&
          (this.isLoggedIn() || this.guestName().trim().length > 0)
        );
      default: return false;
    }
  });

  // ── Two-way binding shim for p-datePicker [(ngModel)] ──────────────────────
  get selectedDateValue(): Date | null {
    return this.selectedDate();
  }
  set selectedDateValue(v: Date | null) {
    this.selectedDate.set(v);
  }

  ngOnInit(): void {
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

  // ── Step navigation ────────────────────────────────────────────────────────

  goNext(): void {
    const step = this.currentStep();

    if (step === 4) {
      this.confirmBooking();
      return;
    }

    if (step === 1) {
      // Clear downstream selections when advancing from service step.
      this.selectedDate.set(null);
      this.slots.set([]);
      this.selectedSlot.set(null);
      this.slotsError.set(false);
    }

    if (step === 2) {
      // Slots may already be loading from onDateSelect(); trigger if not.
      const b = this.business();
      const svc = this.selectedService();
      const dateStr = this.selectedDateStr();
      if (b && svc && dateStr && !this.loadingSlots() && this.slots().length === 0 && !this.slotsError()) {
        this.loadSlots(b.id, svc.id, dateStr);
      }
    }

    this.currentStep.set((step + 1) as BookStep);
  }

  goStepBack(): void {
    const step = this.currentStep();
    if (step <= 1) {
      this.goToHome();
    } else {
      this.currentStep.set((step - 1) as BookStep);
    }
  }

  // ── Step-3 helpers ─────────────────────────────────────────────────────────

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
    this.currentStep.set(2);
  }

  // ── Selection handlers ─────────────────────────────────────────────────────

  selectService(svc: PublicService): void {
    // Clear downstream state when the service changes.
    if (this.selectedService()?.id !== svc.id) {
      this.selectedDate.set(null);
      this.slots.set([]);
      this.selectedSlot.set(null);
      this.slotsError.set(false);
    }
    this.selectedService.set(svc);
  }

  onDateSelect(): void {
    const b = this.business();
    const svc = this.selectedService();
    const dateStr = this.selectedDateStr();
    if (!b || !svc || !dateStr) return;
    // Start loading slots proactively so they're ready when the user reaches step 3.
    this.slots.set([]);
    this.selectedSlot.set(null);
    this.slotsError.set(false);
    this.loadSlots(b.id, svc.id, dateStr);
  }

  selectSlot(slot: string): void {
    this.selectedSlot.set(slot);
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

    const body: CreateAppointmentBody = {
      businessId: b.id,
      serviceId: svc.id,
      date: dateStr,
      time,
    };
    if (!loggedIn) {
      body.customerName = name;
      body.customerPhone = this.guestPhone().trim() || undefined;
    }

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
        if (err?.status === 409 && err?.error?.code === 'SLOT_TAKEN') {
          this.messageService.add({
            severity: 'warn',
            summary: 'תפוס',
            detail: 'התור נתפס, בחרי שעה אחרת',
            life: 5000,
          });
          // Go back to step 3 with refreshed slots.
          this.currentStep.set(3);
          const b2 = this.business();
          const svc2 = this.selectedService();
          if (b2 && svc2 && dateStr) {
            this.loadSlots(b2.id, svc2.id, dateStr);
          }
        } else {
          this.showError(err?.error?.message ?? 'שגיאה באישור התור');
          // Reset the hold ring so the customer can try again without
          // navigating away.  Toggle the signal off then back on so Angular
          // destroys and recreates the component, clearing internal state.
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
      },
      error: (err) => {
        this.loadingServices.set(false);
        this.showError(err?.error?.message ?? 'שגיאה בטעינת השירותים');
      },
    });
  }

  private loadSlots(businessId: string, serviceId: string, dateStr: string): void {
    this.loadingSlots.set(true);
    this.slotsError.set(false);
    this.publicApi.getAvailabilityByBusinessId(businessId, serviceId, dateStr).subscribe({
      next: (res) => {
        this.slots.set(res.slots);
        this.selectedSlot.set(null);
        this.loadingSlots.set(false);
      },
      error: (err) => {
        this.loadingSlots.set(false);
        this.slotsError.set(true);
        this.showError(err?.error?.message ?? 'שגיאה בטעינת השעות');
      },
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
