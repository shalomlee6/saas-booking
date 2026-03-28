import {
 Component,
 OnInit,
 inject,
 computed,
 signal,
 effect,
 untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CarouselModule } from 'primeng/carousel';
import { DrawerModule } from 'primeng/drawer';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import {
  PublicApiService,
  type UpcomingAppointment,
} from '../services/public-api.service';
import { PublicSessionService } from '../services/public-session.service';

/** Map status values to Hebrew labels. */
const STATUS_LABEL: Record<string, string> = {
  confirmed: 'מאושר',
  pending: 'ממתין',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

/** Map status values to PrimeNG tag severity. */
const STATUS_SEVERITY: Record<
  string,
  'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
> = {
  confirmed: 'success',
  pending: 'warn',
  completed: 'secondary',
  cancelled: 'danger',
};

/** Format YYYY-MM-DD → Hebrew-friendly long date (e.g. "שישי, 14 בפברואר 2025"). */
function formatDateHe(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Statuses that allow a customer to cancel their appointment. */
const CANCELLABLE_STATUSES = new Set(['confirmed', 'pending']);

@Component({
  selector: 'app-public-landing',
  standalone: true,
  imports: [ButtonModule, CarouselModule, DrawerModule, FormsModule, TextareaModule, SkeletonModule, TagModule],
  templateUrl: './public-landing.component.html',
  styleUrl: './public-landing.component.scss',
})
export class PublicLandingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicApi = inject(PublicApiService);
  private readonly session = inject(PublicSessionService);
  private readonly messageService = inject(MessageService);

  constructor() {
    // Safety net: if the authenticated customer identity changes while this component
    // is alive (tab reuse, future in-page auth flow, etc.), clear every piece of
    // appointment state immediately so stale data can never bleed to the new identity.
    let prevCustomerId: string | null | undefined;
    effect(() => {
      const currentId = this.session.customerId();
      if (prevCustomerId !== undefined && prevCustomerId !== currentId) {
        untracked(() => {
          this.upcomingApt.set(null);
          this.justBookedApt.set(null);
          this.upcomingError.set(false);
          this.loadingUpcoming.set(false);
        });
      }
      prevCustomerId = currentId;
    });
  }

  readonly businessSlug = computed(
    () => this.route.parent?.snapshot.paramMap.get('slug') ?? ''
  );

  readonly greetingTitle = computed(() => {
    const name = this.session.customerName();
    return name ? `שלום, ${name}, ברוכות הבאות` : 'שלום, ברוכות הבאות';
  });

  readonly greetingSub = 'בואי נקבע תור בקלות ובמהירות';

  readonly carouselImages = [
    'https://picsum.photos/800/400?random=1',
    'https://picsum.photos/800/400?random=2',
    'https://picsum.photos/800/400?random=3',
  ];

  readonly loadingUpcoming = signal(false);
  readonly upcomingApt = signal<UpcomingAppointment | null>(null);
  readonly upcomingError = signal(false);
  /** When a booking just completed, show the just-booked apt until the real fetch resolves. */
  readonly justBookedApt = signal<UpcomingAppointment | null>(null);

  /** The appointment to display: prefer the live-fetched one, fall back to just-booked. */
  readonly displayApt = computed(
    () => this.upcomingApt() ?? this.justBookedApt()
  );

  // ── Cancellation drawer state ─────────────────────────────────────────────
  readonly cancelDrawerOpen = signal(false);
  readonly cancelReason = signal('');
  readonly cancelReasonTouched = signal(false);
  readonly cancelling = signal(false);
  readonly cancelError = signal<string | null>(null);

  readonly canCancelApt = computed(() => {
    const apt = this.displayApt();
    return !!apt && CANCELLABLE_STATUSES.has(apt.status);
  });

  readonly cancelReasonInvalid = computed(
    () => this.cancelReasonTouched() && this.cancelReason().trim().length === 0
  );

  readonly cancelBtnDisabled = computed(
    () => this.cancelling() || this.cancelReason().trim().length === 0
  );

  readonly statusLabel = computed(() => {
    const apt = this.displayApt();
    return apt ? (STATUS_LABEL[apt.status] ?? apt.status) : '';
  });

  readonly statusSeverity = computed(() => {
    const apt = this.displayApt();
    return apt
      ? (STATUS_SEVERITY[apt.status] ?? 'secondary')
      : 'secondary';
  });

  readonly formattedDate = computed(() => {
    const apt = this.displayApt();
    return apt ? formatDateHe(apt.date) : '';
  });

  ngOnInit(): void {
    const slug = this.businessSlug();
    // The customer ID that belongs to the current authenticated session.
    const currentCustomerId = this.session.customerId();

    // Read router state written by CustomerBookPageComponent on successful booking.
    // history.state persists for the current navigation only and is absent on refresh.
    const state = (typeof window !== 'undefined' ? window.history.state : {}) as Record<string, unknown>;
    if (state?.['booked'] === true) {
      const aptData = state['apt'] as UpcomingAppointment | undefined;
      // IDENTITY GUARD: only accept the just-booked appointment card if its
      // embedded customerId matches the current session.  This prevents a
      // lingering history entry from a previous customer being shown to a
      // different customer who navigates to the same URL later.
      const stateCustomerId = (state['customerId'] as string | null | undefined) ?? null;
      const identityMatch = stateCustomerId === currentCustomerId;

      if (aptData && identityMatch) {
        this.justBookedApt.set(aptData);
      }

      // Always show the success toast — the booking itself succeeded regardless.
      this.messageService.add({
        severity: 'success',
        summary: 'התור נקבע!',
        detail: 'התור שלך אושר בהצלחה',
        life: 5000,
      });

      // Neutralise the state so back/forward navigation does not re-trigger it.
      if (typeof window !== 'undefined') {
        window.history.replaceState({ ...state, booked: false }, '');
      }
    }

    // Fetch the real upcoming appointment only for the currently authenticated customer.
    if (slug && this.session.hasSessionFor(slug)) {
      this.loadUpcoming();
    }
  }

  loadUpcoming(): void {
    this.loadingUpcoming.set(true);
    this.upcomingError.set(false);
    this.publicApi.getUpcomingAppointment().subscribe({
      next: (res) => {
        this.upcomingApt.set(res.appointment);
        this.loadingUpcoming.set(false);
      },
      error: () => {
        this.upcomingError.set(true);
        this.loadingUpcoming.set(false);
      },
    });
  }

  openCancelDrawer(): void {
    this.cancelReason.set('');
    this.cancelReasonTouched.set(false);
    this.cancelError.set(null);
    this.cancelDrawerOpen.set(true);
  }

  closeCancelDrawer(): void {
    if (this.cancelling()) return;
    this.cancelDrawerOpen.set(false);
  }

  confirmCancel(): void {
    this.cancelReasonTouched.set(true);
    const reason = this.cancelReason().trim();
    if (!reason) return;

    const apt = this.displayApt();
    if (!apt) return;

    this.cancelling.set(true);
    this.cancelError.set(null);

    this.publicApi.cancelAppointment(apt.id, reason).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.cancelDrawerOpen.set(false);
        // Clear local appointment state immediately, then fetch fresh state.
        this.upcomingApt.set(null);
        this.justBookedApt.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'התור בוטל',
          detail: 'התור שלך בוטל בהצלחה',
          life: 5000,
        });
        // Refresh from server to get accurate state.
        if (this.session.hasSessionFor(this.businessSlug())) {
          this.loadUpcoming();
        }
      },
      error: (err: { error?: { message?: string }; status?: number }) => {
        this.cancelling.set(false);
        const serverMsg = err?.error?.message;
        if (err?.status === 409) {
          this.cancelError.set(serverMsg ?? 'התור כבר בוטל');
        } else if (err?.status === 404) {
          this.cancelError.set('התור לא נמצא. ייתכן שכבר בוטל.');
        } else {
          this.cancelError.set('אירעה שגיאה. אנא נסי שוב.');
        }
      },
    });
  }

  goToBook(): void {
    const slug = this.businessSlug();
    if (slug) this.router.navigate(['/b', slug, 'book']);
  }
}
