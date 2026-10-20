import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { NgStyle } from '@angular/common';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { PublicLandingBookingCtaComponent } from '../../../../public/booking/landing/components/booking-cta/public-landing-booking-cta.component';
import { PublicLandingNextAppointmentComponent } from '../../../../public/booking/landing/components/next-appointment/public-landing-next-appointment.component';
import { PublicLandingServicesComponent } from '../../../../public/booking/landing/components/services/public-landing-services.component';
import { PublicTimeSlotsComponent } from '../../../../public/components/public-time-slots/public-time-slots.component';
import { PublicTopbarComponent } from '../../../../public/layout/public-topbar/public-topbar.component';
import type { PublicService, UpcomingAppointment } from '../../../../public/services/public-api.service';

const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A phone-sized view of the client site, built from the site's own components (top bar, upcoming
 * appointment card with its status tag, booking CTA, service cards, time slots) with the theme's tokens.
 *
 * The tokens are set on the frame element only. CSS custom properties inherit downward, so nothing here can
 * reach the owner UI around it. The frame is inert: it is a picture of the site, not a second site to tab through.
 */
@Component({
  selector: 'app-public-theme-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgStyle,
    TranslatePipe,
    PublicTopbarComponent,
    PublicLandingNextAppointmentComponent,
    PublicLandingBookingCtaComponent,
    PublicLandingServicesComponent,
    PublicTimeSlotsComponent,
  ],
  template: `
    <div class="preview">
      <div class="preview-toolbar">
        <span class="preview-label" id="theme-preview-mode-label">{{ 'settings.clientPreviewMode' | translate }}</span>
        <div class="settings-segment" role="radiogroup" aria-labelledby="theme-preview-mode-label">
          <label class="settings-segment-option">
            <input type="radio" name="previewMode" value="light" [checked]="mode() === 'light'" (change)="mode.set('light')" />
            <span><i class="pi pi-sun" aria-hidden="true"></i>&nbsp;{{ 'settings.themeModeLight' | translate }}</span>
          </label>
          <label class="settings-segment-option">
            <input type="radio" name="previewMode" value="dark" [checked]="mode() === 'dark'" (change)="mode.set('dark')" />
            <span><i class="pi pi-moon" aria-hidden="true"></i>&nbsp;{{ 'settings.themeModeDark' | translate }}</span>
          </label>
        </div>
      </div>

      <div class="preview-phone" data-testid="theme-preview">
        <div
          class="public-shell preview-shell"
          [class.theme-light]="mode() === 'light'"
          [class.theme-dark]="mode() === 'dark'"
          [ngStyle]="vars()"
          [attr.dir]="direction()"
          inert
          aria-hidden="true"
        >
          <app-public-topbar title="boki" />
          <div class="preview-page">
            <div class="preview-greeting">
              <h3 class="preview-greeting-title">{{ 'publicLanding.greetingAnon' | translate }}</h3>
              <p class="preview-greeting-sub">{{ 'publicLanding.greetingSub' | translate }}</p>
            </div>
            <app-public-landing-next-appointment [apt]="appointment" [staffLine]="''" />
            <app-public-landing-booking-cta phone="0500000000" />
            <app-public-landing-services [services]="services" />
            <section class="preview-slots">
              <h3 class="preview-slots-title">{{ 'publicBook.slotsLabel' | translate }}</h3>
              <app-public-time-slots [slots]="slots" selected="10:00" [label]="'publicBook.slotsLabel' | translate" />
            </section>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: '../../business-settings/settings-section.scss',
  styles: `
    :host {
      display: block;
    }

    .preview {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      align-items: center;
    }

    .preview-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1rem;
      inline-size: 100%;
      max-inline-size: 23.75rem;
    }

    .preview-label {
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 600;
    }

    /* The phone: a fixed 360px viewport that scrolls inside its own frame. */
    .preview-phone {
      inline-size: 100%;
      max-inline-size: 23.75rem;
      block-size: 37.5rem;
      overflow: hidden;
      border: 6px solid color-mix(in srgb, var(--text-primary) 85%, var(--bg-card));
      border-radius: 2rem;
      box-shadow: var(--shadow-md);
      isolation: isolate;
      contain: paint;
    }

    .preview-shell {
      block-size: 100%;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }

    .preview-page {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 1.25rem 1rem 2rem;
    }

    .preview-greeting {
      text-align: center;
    }

    .preview-greeting-title {
      margin: 0 0 0.35rem;
      color: var(--text-primary);
      font-size: 20px;
      font-weight: 600;
    }

    .preview-greeting-sub {
      margin: 0;
      color: var(--text-muted);
      font-size: 14px;
    }

    .preview-slots {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .preview-slots-title {
      margin: 0;
      color: var(--text-primary);
      font-size: 0.9375rem;
      font-weight: 600;
    }
  `,
})
export class PublicThemePreviewComponent {
  private readonly language = inject(LanguageService);

  /** The theme's tokens, from the same resolver the real site uses. */
  readonly vars = input.required<Record<string, string>>();
  readonly mode = model<'light' | 'dark'>('light');

  readonly direction = computed(() => (this.language.language() === 'he' ? 'rtl' : 'ltr'));

  readonly appointment: UpcomingAppointment = {
    id: 'preview',
    date: inDays(3),
    time: '10:30',
    status: 'confirmed',
    serviceName: 'Manicure',
    canChange: false,
  };

  readonly services: PublicService[] = [
    { id: 'preview-1', nameHe: 'Manicure', durationMinutes: 45, price: 120 },
    { id: 'preview-2', nameHe: 'Pedicure', durationMinutes: 60, price: 160 },
  ];

  readonly slots = SLOTS;
}
