import {
  Component,
  OnInit,
  inject,
  computed,
  signal,
  effect,
  untracked,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { forkJoin, distinctUntilChanged, map } from 'rxjs';
import {
  PublicApiService,
  type PublicBusinessForBooking,
  type PublicLandingProductItem,
  type PublicLandingReviewItem,
  type PublicService,
  type UpcomingAppointment,
} from '../../../services/public-api.service';
import { PublicSessionService } from '../../../services/public-session.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import {
  PublicLandingHeroComponent,
  PUBLIC_LANDING_DEFAULT_HERO_PHOTOS,
} from '../components/hero/public-landing-hero.component';
import { PublicLandingNextAppointmentComponent } from '../components/next-appointment/public-landing-next-appointment.component';
import { PublicLandingServicesComponent } from '../components/services/public-landing-services.component';
import { PublicLandingGalleryComponent } from '../components/gallery/public-landing-gallery.component';
import { PublicLandingProductsComponent } from '../components/products/public-landing-products.component';
import { PublicLandingReviewsComponent } from '../components/reviews/public-landing-reviews.component';
import { PublicLandingBookingCtaComponent } from '../components/booking-cta/public-landing-booking-cta.component';

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

const DEFAULT_TAGLINE = 'יופי מקצועי, תוצאות מושלמות';

@Component({
  selector: 'app-public-landing',
  standalone: true,
  imports: [
    ButtonModule,
    DrawerModule,
    FormsModule,
    TextareaModule,
    SkeletonModule,
    TagModule,
    PublicLandingHeroComponent,
    PublicLandingNextAppointmentComponent,
    PublicLandingServicesComponent,
    PublicLandingGalleryComponent,
    PublicLandingProductsComponent,
    PublicLandingReviewsComponent,
    PublicLandingBookingCtaComponent,
  ],
  templateUrl: './public-landing.component.html',
  styleUrl: './public-landing.component.scss',
})
export class PublicLandingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicApi = inject(PublicApiService);
  private readonly session = inject(PublicSessionService);
  private readonly messageService = inject(MessageService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
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

  /** Reactive slug from parent route (`/b/:slug`). */
  readonly businessSlug = signal('');

  readonly greetingTitle = computed(() => {
    const name = this.session.customerName();
    return name ? `שלום, ${name}, ברוכות הבאות` : 'שלום, ברוכות הבאות';
  });

  readonly greetingSub = 'בואי נקבע תור בקלות ובמהירות';

  readonly loadingPageData = signal(true);
  readonly pageLoadError = signal<string | null>(null);
  readonly bookingBusiness = signal<PublicBusinessForBooking | null>(null);
  readonly servicesList = signal<PublicService[]>([]);

  readonly landingTagline = computed(
    () => this.bookingBusiness()?.landing?.tagline?.trim() || DEFAULT_TAGLINE
  );

  /**
   * Two hero photos side by side: cover URL, then `media.photos`, then defaults
   * (same sources as the original carousel — business imagery with picsum fallback).
   */
  private readonly heroPhotoPair = computed((): readonly [string, string] => {
    const b = this.bookingBusiness();
    const ordered: string[] = [];
    const add = (u: string | null | undefined): void => {
      const t = typeof u === 'string' ? u.trim() : '';
      if (t && !ordered.includes(t)) ordered.push(t);
    };
    add(b?.landing?.coverImageUrl);
    for (const p of b?.media?.photos ?? []) {
      add(p);
    }
    const [d0, d1] = PUBLIC_LANDING_DEFAULT_HERO_PHOTOS;
    if (ordered.length >= 2) {
      return [ordered[0], ordered[1]];
    }
    if (ordered.length === 1) {
      return [ordered[0], d1];
    }
    return [d0, d1];
  });

  readonly heroImageLeft = computed(() => this.heroPhotoPair()[0]);

  readonly heroImageRight = computed(() => this.heroPhotoPair()[1]);

  readonly businessDisplayName = computed(() => this.bookingBusiness()?.name ?? '');

  readonly landingPhone = computed(() => this.bookingBusiness()?.landing?.phone ?? null);

  readonly portfolioImages = computed(
    () => this.bookingBusiness()?.landing?.portfolioImages ?? []
  );

  readonly landingProducts = computed((): PublicLandingProductItem[] => {
    const raw = this.bookingBusiness()?.landing?.products ?? [];
    return raw.filter((p) => p.name?.trim());
  });

  readonly showProductsSection = computed(() => this.landingProducts().length > 0);

  readonly landingReviews = computed((): PublicLandingReviewItem[] => {
    const raw = this.bookingBusiness()?.landing?.reviews ?? [];
    return raw.filter((r) => r.text?.trim());
  });

  readonly showReviewsSection = computed(() => this.landingReviews().length > 0);

  readonly statsRating = computed(
    () => this.bookingBusiness()?.landing?.stats?.rating ?? 5
  );

  readonly statsCustomers = computed(
    () => this.bookingBusiness()?.landing?.stats?.customersCount ?? 0
  );

  readonly statsCompleted = computed(
    () => this.bookingBusiness()?.landing?.stats?.completedAppointmentsCount ?? 0
  );

  /**
   * True when the back-office owner (or impersonating super-admin) views their own public slug.
   * Requires `auth.init()` to have populated `user` / `business`.
   */
  readonly isOwnerViewingOwnLanding = computed(() => {
    const slug = this.businessSlug();
    if (!slug || !this.auth.initialized()) return false;
    const u = this.auth.user();
    const b = this.auth.business();
    if (!u || !b || b.slug !== slug) return false;
    if (u.role === 'owner') return true;
    return u.role === 'super_admin' && this.auth.isImpersonating();
  });

  readonly stickyPhoneHref = computed((): string | null => {
    const p = this.landingPhone();
    if (!p?.trim()) return null;
    const digits = p.replace(/\D/g, '');
    return digits.length > 0 ? `tel:${digits}` : null;
  });

  readonly loadingUpcoming = signal(false);
  readonly upcomingApt = signal<UpcomingAppointment | null>(null);
  readonly upcomingError = signal(false);
  readonly justBookedApt = signal<UpcomingAppointment | null>(null);

  readonly displayApt = computed(
    () => this.upcomingApt() ?? this.justBookedApt()
  );

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
    this.auth.init().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    this.route.parent!.paramMap
      .pipe(
        map((p) => p.get('slug') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((slug) => {
        this.businessSlug.set(slug);
        if (!slug) {
          this.loadingPageData.set(false);
          this.pageLoadError.set('חסר מזהה עסק');
          return;
        }

        this.consumeBookedHistoryState();
        this.reloadLandingData(slug);

        if (this.session.hasSessionFor(slug)) {
          this.loadUpcoming();
        } else {
          this.upcomingApt.set(null);
          this.justBookedApt.set(null);
          this.upcomingError.set(false);
          this.loadingUpcoming.set(false);
        }
      });
  }

  private reloadLandingData(slug: string): void {
    this.bookingBusiness.set(null);
    this.servicesList.set([]);
    this.loadingPageData.set(true);
    this.pageLoadError.set(null);
    forkJoin({
      biz: this.publicApi.getBusinessForBooking(slug),
      svc: this.publicApi.getServices(slug),
    }).subscribe({
      next: ({ biz, svc }) => {
        this.bookingBusiness.set(biz);
        this.servicesList.set(svc);
        this.loadingPageData.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.pageLoadError.set(err?.error?.message ?? 'שגיאה בטעינת העמוד');
        this.loadingPageData.set(false);
      },
    });
  }

  private consumeBookedHistoryState(): void {
    const slug = this.businessSlug();
    const currentCustomerId = this.session.customerId();
    const state = (typeof window !== 'undefined' ? window.history.state : {}) as Record<
      string,
      unknown
    >;
    if (state?.['booked'] !== true) return;

    const aptData = state['apt'] as UpcomingAppointment | undefined;
    const stateCustomerId = (state['customerId'] as string | null | undefined) ?? null;
    const identityMatch = stateCustomerId === currentCustomerId;

    if (aptData && identityMatch) {
      this.justBookedApt.set(aptData);
    }

    this.messageService.add({
      severity: 'success',
      summary: 'התור נקבע!',
      detail: 'התור שלך אושר בהצלחה',
      life: 5000,
    });

    if (typeof window !== 'undefined') {
      window.history.replaceState({ ...state, booked: false }, '');
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
        this.upcomingApt.set(null);
        this.justBookedApt.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'התור בוטל',
          detail: 'התור שלך בוטל בהצלחה',
          life: 5000,
        });
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

  goToBook(serviceId?: string): void {
    const slug = this.businessSlug();
    if (!slug) return;
    if (serviceId) {
      this.router.navigate(['/b', slug, 'book'], {
        queryParams: { service: serviceId },
      });
    } else {
      this.router.navigate(['/b', slug, 'book']);
    }
  }
}
