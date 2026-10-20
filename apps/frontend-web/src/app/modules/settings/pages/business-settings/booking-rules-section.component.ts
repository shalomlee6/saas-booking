import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/api/api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SettingsSaveBarComponent } from './settings-save-bar.component';
import { SettingsResetService } from './reset/settings-reset.service';
import { SettingsSectionResetComponent } from './reset/settings-section-reset.component';

interface BookingRules {
  enabled: boolean;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  bufferMinutes: number;
  onlineDefaultStatus: 'confirmed' | 'pending';
  maxActiveAppointmentsPerClient: number | null;
  clientCanCancelOnline: boolean;
  cancellationWindowHours: number;
}

/** Shown for the instant before the stored rules arrive: nothing on, nothing set. Not a default. */
const BLANK_RULES: BookingRules = {
  enabled: false,
  minLeadMinutes: 0,
  maxAdvanceDays: 0,
  bufferMinutes: 0,
  onlineDefaultStatus: 'confirmed',
  maxActiveAppointmentsPerClient: null,
  clientCanCancelOnline: false,
  cancellationWindowHours: 0,
};

@Component({
  selector: 'app-booking-rules-section',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SettingsSaveBarComponent, SettingsSectionResetComponent],
  templateUrl: './booking-rules-section.component.html',
  styleUrl: './settings-section.scss',
})
export class BookingRulesSectionComponent {
  private readonly api = inject(ApiService);
  private readonly messages = inject(MessageService);
  private readonly reset = inject(SettingsResetService);
  private readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  readonly leadOptions = [0, 30, 60, 120, 180, 360, 720, 1440];
  readonly bufferOptions = [0, 5, 10, 15, 20, 30];
  readonly capOptions = [1, 2, 3, 5, 10];
  /** The server's defaults (from /auth/me) are the only fallback; there is no copy of them in this file. */
  private readonly initial = this.initialRules();
  readonly rules = signal<BookingRules>(this.initial);
  private readonly saved = signal<BookingRules>(this.initial);
  readonly dirty = computed(() => JSON.stringify(this.rules()) !== JSON.stringify(this.saved()));
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Loads on open, and again after a factory reset or a restore.
    effect(() => {
      this.reset.version();
      untracked(() => this.load());
    });
  }

  private initialRules(): BookingRules {
    const defaults = this.auth.settingsDefaults();
    if (!defaults) return BLANK_RULES;
    return { ...defaults.onlineBooking, cancellationWindowHours: defaults.cancellationWindowHours };
  }

  private load(): void {
    this.api.get<{ booking: BookingRules }>('settings/me/booking-rules').subscribe({
      next: (body) => {
        const loaded = { ...this.initialRules(), ...body.booking };
        this.rules.set(loaded);
        this.saved.set(loaded);
        this.error.set(null);
      },
      error: () => this.error.set(this.language.t('settings.loadFailed')),
    });
  }

  patch(partial: Partial<BookingRules>): void {
    this.rules.update((current) => ({ ...current, ...partial }));
  }

  save(): void {
    this.saving.set(true);
    const sent = this.rules();
    this.api.put('settings/me/booking-rules', sent).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(sent);
        this.reset.refresh();
        this.messages.add({ severity: 'success', summary: this.language.t('settings.saved') });
      },
      error: () => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', summary: this.language.t('settings.saveError') });
      },
    });
  }
}
