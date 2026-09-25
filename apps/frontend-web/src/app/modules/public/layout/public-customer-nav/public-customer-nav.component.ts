import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { PublicApiService } from '../../services/public-api.service';
import { PublicSessionService } from '../../services/public-session.service';
import { readBusinessSlugFromPathFromRoot } from '../../utils/public-route-snapshot.util';

export type PublicNavItemId = 'home' | 'upcoming' | 'location' | 'settings';

@Component({
  selector: 'app-public-customer-nav',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './public-customer-nav.component.html',
  styleUrl: './public-customer-nav.component.scss',
})
export class PublicCustomerNavComponent implements OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(PublicSessionService);
  private readonly publicApi = inject(PublicApiService);
  readonly language = inject(LanguageService);

  private readonly menuBtn = viewChild<ElementRef<HTMLButtonElement>>('menuBtn');
  private readonly firstLink = viewChild<ElementRef<HTMLAnchorElement>>('firstLink');

  readonly slug = computed(() => readBusinessSlugFromPathFromRoot(this.route));
  readonly menuOpen = signal(false);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly activeItem = computed((): PublicNavItemId | null => {
    const url = this.currentUrl();
    const path = url.split('#')[0].split('?')[0];
    const fragment = url.includes('#') ? url.split('#')[1] : '';
    const slug = this.slug();
    if (!slug) return null;
    const base = `/b/${slug}`;
    if (path === `${base}/settings` || path.startsWith(`${base}/settings/`)) {
      return 'settings';
    }
    if (path === `${base}/upcoming` || path.startsWith(`${base}/upcoming/`)) {
      return 'upcoming';
    }
    if (path === base || path === `${base}/`) {
      if (fragment === 'public-location') return 'location';
      return 'home';
    }
    return null;
  });

  readonly menuAriaLabel = computed(() =>
    this.menuOpen()
      ? this.language.t('navigation.publicCloseMenu')
      : this.language.t('navigation.publicOpenMenu')
  );

  readonly menuToggleIcon = computed(() =>
    this.menuOpen() ? 'pi pi-times' : 'pi pi-bars'
  );

  ngOnDestroy(): void {
    this.doc.body.classList.remove('public-nav-lock');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen()) {
      this.closeMenu(true);
    }
  }

  toggleMenu(): void {
    const open = !this.menuOpen();
    this.menuOpen.set(open);
    this.doc.body.classList.toggle('public-nav-lock', open);
    if (open) {
      queueMicrotask(() => this.firstLink()?.nativeElement.focus());
    }
  }

  closeMenu(restoreFocus = false): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    this.doc.body.classList.remove('public-nav-lock');
    if (restoreFocus) {
      this.menuBtn()?.nativeElement.focus();
    }
  }

  onNavClick(): void {
    this.closeMenu();
  }

  onLogout(): void {
    const slug = this.slug();
    // Best-effort: clears the server-side httpOnly cookie so it can't keep authenticating
    // requests as this customer after the client-side session is gone.
    this.publicApi.logoutPublicCustomer().subscribe({ next: () => {}, error: () => {} });
    this.session.clearSession(slug || undefined);
    this.closeMenu();
    if (slug) {
      void this.router.navigate(['/b', slug]);
    }
  }
}
