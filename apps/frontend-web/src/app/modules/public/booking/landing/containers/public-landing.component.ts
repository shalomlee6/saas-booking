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
import { forkJoin, distinctUntilChanged, map } from 'rxjs';
import {
  PublicApiService,
  type PublicBusinessForBooking,
  type PublicLandingGalleryItem,
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
import { PublicAppointmentDetailsComponent } from '../../../components/public-appointment-details/public-appointment-details.component';
import { PublicLandingServicesComponent } from '../components/services/public-landing-services.component';
import { PublicLandingGalleryComponent } from '../components/gallery/public-landing-gallery.component';
import { PublicLandingProductsComponent } from '../components/products/public-landing-products.component';
import { PublicLandingReviewsComponent } from '../components/reviews/public-landing-reviews.component';
import { PublicLandingBookingCtaComponent } from '../components/booking-cta/public-landing-booking-cta.component';
import { PlRevealDirective } from '../directives/pl-reveal.directive';
import { resolvePublicAssetUrl } from '../../../../../shared/utils/public-asset-url';

const DEFAULT_TAGLINE = 'יופי מקצועי, תוצאות מושלמות';

/** sessionStorage key prefix for the once-per-session hero entrance animation, scoped per tenant slug. */
const ENTRANCE_SEEN_KEY_PREFIX = 'boki:landingEntranceSeen:';

/**
 * Decides whether the hero entrance animation should play for this tenant slug,
 * and records that it has been shown so it does not replay later in the same
 * browser session (e.g. navigating back to the landing page, or re-rendering
 * after booking). Guarded so a page with sessionStorage unavailable (private
 * browsing, SSR) still renders normally — it just may play the animation again.
 */
function shouldPlayEntranceAnimation(slug: string): boolean {
  if (typeof window === 'undefined' || !slug) return false;
  const key = `${ENTRANCE_SEEN_KEY_PREFIX}${slug}`;
  try {
    if (window.sessionStorage.getItem(key)) {
      return false;
    }
  } catch {
    // sessionStorage read blocked — fall through and allow the animation once.
  }
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // sessionStorage write blocked — nothing to persist; rendering is unaffected.
  }
  return true;
}

@Component({
  selector: 'app-public-landing',
  standalone: true,
  imports: [
    PublicLandingHeroComponent,
    PublicLandingNextAppointmentComponent,
    PublicAppointmentDetailsComponent,
    PublicLandingServicesComponent,
    PublicLandingGalleryComponent,
    PublicLandingProductsComponent,
    PublicLandingReviewsComponent,
    PublicLandingBookingCtaComponent,
    PlRevealDirective,
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
          // A logout clears customerId to null — nothing to fetch. A login (or switching
          // to a different customer without navigating away) sets a new id — the stale
          // clear above is not enough on its own, this must actually re-fetch or the
          // previous customer's appointment can appear to "stick" after switching identity.
          if (currentId && this.session.hasSessionFor(this.businessSlug())) {
            this.loadUpcoming();
          }
        });
      }
      prevCustomerId = currentId;
    });
  }

  /** Reactive slug from parent route (`/b/:slug`). */
  readonly businessSlug = signal('');

  /**
   * Whether the hero entrance animation should play. True at most once per
   * tenant per browser session — see `shouldPlayEntranceAnimation`.
   */
  readonly playHeroEntrance = signal(false);

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

  readonly landingHeroDescription = computed(
    () => this.bookingBusiness()?.landing?.heroDescription?.trim() ?? ''
  );

  readonly sectionVisibility = computed(() => {
    const v = this.bookingBusiness()?.landing?.sectionVisibility;
    return {
      hero: v?.hero !== false,
      services: v?.services !== false,
      gallery: v?.gallery !== false,
      products: v?.products !== false,
      reviews: v?.reviews !== false,
      cta: v?.cta !== false,
    };
  });

  /**
   * Two hero photos side by side: cover URL, then `media.photos`, then defaults
   * (same sources as the original carousel — business imagery with picsum fallback).
   */
  private readonly heroPhotoPair = computed((): readonly [string, string] => {
    const b = this.bookingBusiness();
    const ordered: string[] = [];
    const add = (u: string | null | undefined): void => {
      const t = resolvePublicAssetUrl(u);
      if (t && !ordered.includes(t)) ordered.push(t);
    };
    add(b?.landing?.coverImageUrl);
    const sec = b?.landing?.secondaryHeroImageUrl;
    if (typeof sec === 'string') add(sec);
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

  readonly landingGalleryItems = computed((): PublicLandingGalleryItem[] => {
    const landing = this.bookingBusiness()?.landing;
    const structured = landing?.galleryItems;
    if (structured && structured.length > 0) {
      return structured.map((g) => ({
        ...g,
        imageUrl: resolvePublicAssetUrl(g.imageUrl),
      }));
    }
    const urls = landing?.portfolioImages ?? [];
    return urls.map((url, i) => ({
      id: `legacy-${i}`,
      imageUrl: resolvePublicAssetUrl(url),
      title: '',
      type: 'service' as const,
    }));
  });

  readonly contactWhatsapp = computed(
    () => this.bookingBusiness()?.landing?.contact?.whatsapp?.trim() || null
  );

  readonly contactEmail = computed(
    () => this.bookingBusiness()?.landing?.contact?.email?.trim() || null
  );

  readonly contactLocation = computed(
    () => this.bookingBusiness()?.landing?.contact?.location?.trim() || null
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

  readonly stickyWhatsappHref = computed((): string | null => {
    const w = this.contactWhatsapp();
    if (!w) return null;
    const digits = w.replace(/\D/g, '');
    return digits.length > 0 ? `https://wa.me/${digits}` : null;
  });

  readonly loadingUpcoming = signal(false);
  readonly upcomingApt = signal<UpcomingAppointment | null>(null);
  readonly upcomingError = signal(false);
  readonly justBookedApt = signal<UpcomingAppointment | null>(null);

  readonly displayApt = computed(
    () => this.upcomingApt() ?? this.justBookedApt()
  );

  readonly detailsApt = signal<UpcomingAppointment | null>(null);

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
        this.playHeroEntrance.set(shouldPlayEntranceAnimation(slug));
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
          this.upcomingError.set(false);
          this.loadingUpcoming.set(false);
        }
      });

    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.scrollToLandingFragment(id);
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
        this.scrollToLandingFragment(this.route.snapshot.fragment);
      },
      error: (err: { error?: { message?: string } }) => {
        this.pageLoadError.set(err?.error?.message ?? 'שגיאה בטעינת העמוד');
        this.loadingPageData.set(false);
      },
    });
  }

  private scrollToLandingFragment(id: string | null): void {
    if (!id || typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  openAppointmentDetails(): void {
    const apt = this.displayApt();
    if (apt) this.detailsApt.set(apt);
  }

  onAppointmentCancelled(): void {
    this.upcomingApt.set(null);
    this.justBookedApt.set(null);
    this.detailsApt.set(null);
    if (this.session.hasSessionFor(this.businessSlug())) {
      this.loadUpcoming();
    }
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

  goToUpcoming(): void {
    const slug = this.businessSlug();
    if (slug) void this.router.navigate(['/b', slug, 'upcoming']);
  }

  onEditAppointment(): void {
    const apt = this.detailsApt() ?? this.displayApt();
    this.detailsApt.set(null);
    this.goToBook(apt?.serviceId);
  }
}
