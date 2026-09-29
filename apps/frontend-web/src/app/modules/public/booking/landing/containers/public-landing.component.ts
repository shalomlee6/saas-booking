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
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
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

/** sessionStorage key prefix for the once-per-session page-load intro animation, scoped per tenant slug. */
const ENTRANCE_SEEN_KEY_PREFIX = 'boki:landingEntranceSeen:';

/**
 * Decides whether the entrance animation should play for this tenant slug,
 * and records that it has been shown so it does not replay later in the same
 * browser session (e.g. navigating back to the landing page, or re-rendering
 * after booking). Guarded so a page with sessionStorage unavailable (private
 * browsing, SSR) still renders normally — it just may play the animation again.
 *
 * `forcePlay` (from the `?intro=1` query param — dev/QA only) always plays
 * the intro and never touches sessionStorage at all, so repeated reloads
 * with that param keep replaying it regardless of what a real visit already
 * recorded.
 */
function shouldPlayEntranceAnimation(slug: string, forcePlay: boolean): boolean {
  if (forcePlay) return true;
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

/** Total wall-clock length of the whole intro sequence (its latest-ending phase,
 *  the floating booking bar: 2025ms delay + 825ms duration), plus a small buffer.
 *  Used to know when it's safe to fully release the stage-background overrides. */
const INTRO_TOTAL_MS = 2900;

/** When the hero slider's own slide-down finishes (375ms delay + 1050ms
 *  duration) — the stage background starts fading to normal at this point,
 *  "as the slider lands", rather than waiting for the whole sequence to end. */
const HERO_LAND_MS = 375 + 1050;

/** How long the stage background takes to fade to the page's normal
 *  background once the hero has landed. */
const STAGE_FADE_MS = 400;

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
    ButtonModule,
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
  private readonly document = inject(DOCUMENT);

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
   * True at most once per tenant per browser session (see
   * `shouldPlayEntranceAnimation`) — decides whether this page load is even
   * a candidate for the intro at all. Doesn't flip off again; `introActive`
   * (below) is what the template actually binds to.
   */
  readonly playIntro = signal(false);

  /**
   * True for exactly the duration of the intro sequence: set once the
   * landing content has actually rendered (see `reloadLandingData` — not at
   * the same time as `playIntro`, which only records the once-per-session
   * decision), then cleared either by the natural end-of-sequence timer or
   * by the user interrupting it (tap/key press) — whichever comes first. Drives
   * the hero slide-down, bottom-sheet slide-up, card slide-in, text fade, and
   * floating bar. Clearing it removes `.pl-page--intro` entirely, which both
   * jumps every element to its final resting state (nothing outside that
   * class carries any `animation`) and drops any `will-change` scoped under
   * it, so nothing lingers promoted to its own compositing layer.
   */
  readonly introActive = signal(false);

  /**
   * Flips true once the hero slider has landed (see `HERO_LAND_MS`) — drives
   * `.pl-page--stage-settled`, whose only job is to fade the stage background
   * back to the page's normal background over `STAGE_FADE_MS`, instead of the
   * instant jump `introActive` going false on its own would otherwise cause.
   * Reset to false at the very start of every intro attempt.
   */
  readonly heroLanded = signal(false);

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
        const forceIntro = this.route.snapshot.queryParamMap.get('intro') === '1';
        this.playIntro.set(shouldPlayEntranceAnimation(slug, forceIntro));
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
        // Start the intro's clock only once the hero/sheet are actually
        // about to render — not back when the slug first resolved, while
        // the page was still showing the loading spinner. requestAnimationFrame
        // waits for the loading→loaded change to actually paint first.
        if (this.playIntro()) {
          requestAnimationFrame(() => {
            this.introActive.set(true);
            this.beginIntroStage();
          });
        }
      },
      error: (err: { error?: { message?: string } }) => {
        this.pageLoadError.set(err?.error?.message ?? 'שגיאה בטעינת העמוד');
        this.loadingPageData.set(false);
      },
    });
  }

  /**
   * Swaps every ancestor's background for the intro's dark/light "stage"
   * color (read off `.public-shell`'s own `--intro-stage-bg`, resolved from
   * the tenant's light/dark mode by `PublicLayoutComponent`) so the exposed
   * backdrop behind the sliding hero/bottom-sheet reads as a deliberate
   * reveal instead of a flash of the normal page background. `.pl-page`
   * itself — the direct parent of both the hero and the sheet, and the one
   * actually painted behind the gaps while they're still off-screen — is
   * handled in CSS instead (`.pl-page--intro { background: ... }` in this
   * component's stylesheet): it's reached for free by the same class this
   * method's caller already sets, so it doesn't need a JS override. `body`
   * and `.public-layout` (the ONE outer wrapper that also carries its own
   * solid `--bg-app`) sit outside this component's own stylesheet scope and
   * need to be reached here instead. Restores every one of them once the
   * sequence is done, or immediately if the user interrupts it. Also wires
   * up the "tap or key press skips the intro" behavior — both live here
   * since they share the same lifecycle. Must only be called once the
   * intro's actual content has rendered (see the caller in
   * `reloadLandingData`) — starting it earlier would burn the sequence's
   * timers against a loading spinner with nothing yet on screen to animate.
   */
  private beginIntroStage(): void {
    if (typeof window === 'undefined') return;
    this.heroLanded.set(false);
    const shell = this.document.querySelector<HTMLElement>('.public-shell');
    const stageColor = shell
      ? getComputedStyle(shell).getPropertyValue('--intro-stage-bg').trim()
      : '';
    const staged: HTMLElement[] = [
      this.document.body,
      this.document.querySelector<HTMLElement>('.public-layout'),
    ].filter((el): el is HTMLElement => !!el);
    if (stageColor) {
      for (const el of staged) {
        el.style.setProperty('background', stageColor);
      }
    }

    // One function for every way the intro can stop — a real interruption
    // (tap or key press; deliberately NOT 'scroll', since the sheet/hero
    // sliding into place changes page height and can trigger a scroll event
    // on its own, which would immediately self-interrupt every playback) or
    // the sequence simply running its course. Either way the listeners and
    // timers must actually be torn down here, not just left to fire into a
    // no-op later — otherwise a fully-played intro still leaks a window-level
    // listener set for the rest of the session. Cleanup here is always
    // instant (no transition), whether or not the smooth landing fade below
    // already ran: once it has, background is already at its final value so
    // removing the inline overrides is a no-op jump; if it hasn't (an early
    // interrupt), an instant jump is correct too — only the natural landing
    // gets the smooth fade.
    const opts: AddEventListenerOptions = { passive: true, once: true };
    const end = (): void => {
      for (const el of staged) {
        el.style.removeProperty('transition');
        el.style.removeProperty('background');
      }
      this.introActive.set(false);
      window.removeEventListener('pointerdown', end);
      window.removeEventListener('wheel', end);
      window.removeEventListener('touchmove', end);
      window.removeEventListener('keydown', end);
      window.clearTimeout(timer);
      window.clearTimeout(settleTimer);
    };

    window.addEventListener('pointerdown', end, opts);
    window.addEventListener('wheel', end, opts);
    window.addEventListener('touchmove', end, opts);
    window.addEventListener('keydown', end, opts);

    // As the slider lands, fade the stage color back to the page's real
    // background over `STAGE_FADE_MS` instead of holding it until the whole
    // sequence ends — removing the override here (rather than jumping to it
    // instantly) lets the browser transition from the stage color to
    // whatever `background` now resolves to (`var(--bg-app)`, via the
    // stylesheet rules `end()` otherwise falls back to).
    const settleTimer = window.setTimeout(() => {
      for (const el of staged) {
        el.style.setProperty('transition', `background-color ${STAGE_FADE_MS}ms ease`);
        el.style.removeProperty('background');
      }
      this.heroLanded.set(true);
    }, HERO_LAND_MS);

    const timer = window.setTimeout(end, INTRO_TOTAL_MS);

    this.destroyRef.onDestroy(end);
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
