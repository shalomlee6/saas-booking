import { Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { AuthService } from '../../../../core/auth/auth.service';
import { SettingsResetService } from './reset/settings-reset.service';
import { SettingsDangerZoneComponent } from './reset/settings-danger-zone.component';
import { SettingsUndoBannerComponent } from './reset/settings-undo-banner.component';

const SECTIONS = [
  {
    id: 'design',
    icon: 'pi pi-palette',
    label: 'settings.sectionDesign',
    hint: 'settings.sectionDesignHint',
    lead: 'settings.sectionDesignLead',
  },
  {
    id: 'hours',
    icon: 'pi pi-clock',
    label: 'settings.sectionHours',
    hint: 'settings.sectionHoursHint',
    lead: 'settings.sectionHoursLead',
  },
  {
    id: 'booking',
    icon: 'pi pi-calendar',
    label: 'settings.sectionBooking',
    hint: 'settings.sectionBookingHint',
    lead: 'settings.sectionBookingLead',
  },
  {
    id: 'reliability',
    icon: 'pi pi-shield',
    label: 'settings.sectionReliability',
    hint: 'settings.sectionReliabilityHint',
    lead: 'settings.sectionReliabilityLead',
  },
  {
    id: 'customers',
    icon: 'pi pi-users',
    label: 'settings.sectionCustomers',
    hint: 'settings.sectionCustomersHint',
    lead: 'settings.sectionCustomersLead',
  },
  {
    id: 'policy',
    icon: 'pi pi-file',
    label: 'settings.sectionPolicy',
    hint: 'settings.sectionPolicyHint',
    lead: 'settings.sectionPolicyLead',
  },
] as const;

@Component({
  selector: 'app-business-settings-shell',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslatePipe,
    SettingsDangerZoneComponent,
    SettingsUndoBannerComponent,
  ],
  templateUrl: './business-settings-shell.component.html',
  styleUrl: './business-settings-shell.component.scss',
})
export class BusinessSettingsShellComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly auth = inject(AuthService);
  private readonly reset = inject(SettingsResetService);
  readonly sections = SECTIONS;
  readonly section = signal<string | null>(null);
  readonly current = computed(() => SECTIONS.find((item) => item.id === this.section()) ?? null);
  /** Factory reset is owner-only (a super-admin impersonating the business counts as its owner). */
  readonly canReset = computed(
    () => this.auth.user()?.role === 'owner' || (this.auth.isSuperAdmin() && this.auth.isImpersonating())
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.readSection();
        this.refreshResetStatus();
      });
    this.readSection();
    this.refreshResetStatus();
    // The section list is always visible (a side list on desktop, a chip row on a phone),
    // so there is no separate "hub" screen: land on the first section.
    if (!this.section()) {
      void this.router.navigate(['/settings/design'], { replaceUrl: true });
    }
  }

  private refreshResetStatus(): void {
    if (this.canReset()) this.reset.refresh();
  }

  private readSection(): void {
    const path = this.router.url.split('?')[0];
    const match = path.match(/\/settings\/(design|hours|booking|reliability|customers|policy)$/);
    this.section.set(match?.[1] ?? null);
    // On a phone the chip row scrolls sideways; keep the open section's chip in view.
    setTimeout(() =>
      this.host.nativeElement
        .querySelector('.settings-nav-link-active')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    );
  }
}
