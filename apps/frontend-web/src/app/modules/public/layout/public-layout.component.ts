import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { Subject, takeUntil, switchMap, catchError, of } from 'rxjs';
import { PublicApiService, type PublicBusiness } from '../services/public-api.service';
import { PublicThemeService } from '../services/public-theme.service';
import { resolveBusinessThemeVars } from '../../../core/theming/resolve-business-theme-vars';
import { ToastModule } from 'primeng/toast';
import { PublicCustomerNavComponent } from './public-customer-nav/public-customer-nav.component';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, ToastModule, PublicCustomerNavComponent, TranslatePipe, NgStyle],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
})
export class PublicLayoutComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly publicApi = inject(PublicApiService);
  private readonly destroy$ = new Subject<void>();

  readonly theme = inject(PublicThemeService);

  readonly businessData = signal<PublicBusiness | null>(null);
  loading = true;
  error: string | null = null;

  /**
   * Tenant accent tokens for the currently active light/dark mode, resolved
   * from the business's configured theme preset, as a CSS custom-property map.
   */
  readonly tenantStyles = computed<Record<string, string>>(() =>
    resolveBusinessThemeVars(this.businessData()?.settings?.theme?.preset, this.theme.mode())
  );

  constructor() {
    // A business's default mode only takes effect if the customer hasn't
    // already made their own explicit light/dark choice on this site.
    effect(() => {
      const mode = this.businessData()?.settings?.theme?.defaultMode;
      this.theme.applyBusinessDefault(mode);
    });
  }

  ngOnInit(): void {
    this.route.parent?.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap((params) => {
          const slug = params.get('slug');
          if (!slug) {
            this.loading = false;
            this.error = 'Missing business';
            return of(null);
          }
          this.loading = true;
          this.error = null;
          return this.publicApi.getBusiness(slug).pipe(
            catchError((err) => {
              this.error = err?.error?.message ?? 'Business not found';
              this.loading = false;
              return of(null);
            })
          );
        })
      )
      .subscribe((data) => {
        this.businessData.set(data ?? null);
        this.loading = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
