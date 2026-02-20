import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { Subject, takeUntil, switchMap, catchError, of } from 'rxjs';
import { PublicApiService, type PublicBusiness } from '../services/public-api.service';
import { ThemeService } from '../../../core/config/theme.service';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
})
export class PublicLayoutComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly publicApi = inject(PublicApiService);
  private readonly theme = inject(ThemeService);
  private readonly destroy$ = new Subject<void>();

  businessData: PublicBusiness | null = null;
  loading = true;
  error: string | null = null;

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
        this.businessData = data ?? null;
        this.loading = false;
        if (data) {
          this.applyBusinessTheme(data);
        }
      });
  }

  private applyBusinessTheme(business: PublicBusiness): void {
    const theme = business.settings?.theme;
    const primary = theme?.colors?.primary;
    if (primary && /^#[0-9A-Fa-f]{6}$/.test(primary)) {
      document.body.style.setProperty('--color-primary', primary);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
