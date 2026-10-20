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

interface Counter {
  enabled: boolean;
  threshold: number;
}

interface ReliabilityRules {
  noShow: Counter;
  lateCancellation: Counter;
  lateArrival: Counter;
  lookback: '12months' | 'all';
}

/** Shown for the instant before the stored rules arrive: nothing counted. Not a default. */
const BLANK_RULES: ReliabilityRules = {
  noShow: { enabled: false, threshold: 0 },
  lateCancellation: { enabled: false, threshold: 0 },
  lateArrival: { enabled: false, threshold: 0 },
  lookback: 'all',
};

@Component({
  selector: 'app-reliability-section',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SettingsSaveBarComponent, SettingsSectionResetComponent],
  templateUrl: './reliability-section.component.html',
  styleUrl: './settings-section.scss',
})
export class ReliabilitySectionComponent {
  private readonly api = inject(ApiService);
  private readonly messages = inject(MessageService);
  private readonly reset = inject(SettingsResetService);
  private readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  /** The server's defaults (from /auth/me) are the only fallback; there is no copy of them in this file. */
  private readonly initial = this.initialRules();
  readonly rules = signal<ReliabilityRules>(this.initial);
  private readonly saved = signal<ReliabilityRules>(this.initial);
  readonly dirty = computed(() => JSON.stringify(this.rules()) !== JSON.stringify(this.saved()));
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly counters = [
    { key: 'noShow' as const, label: 'settings.reliabilityNoShow' },
    { key: 'lateCancellation' as const, label: 'settings.reliabilityLateCancel' },
    { key: 'lateArrival' as const, label: 'settings.reliabilityLateArrival' },
  ];

  constructor() {
    // Loads on open, and again after a factory reset or a restore.
    effect(() => {
      this.reset.version();
      untracked(() => this.load());
    });
  }

  private initialRules(): ReliabilityRules {
    const defaults = this.auth.settingsDefaults();
    if (!defaults) return BLANK_RULES;
    return { noShow: defaults.noShowPolicy, ...defaults.reliability };
  }

  private load(): void {
    this.api.get<{ reliability: ReliabilityRules }>('settings/me/booking-rules').subscribe({
      next: (body) => {
        const loaded = { ...this.initialRules(), ...body.reliability };
        this.rules.set(loaded);
        this.saved.set(loaded);
        this.error.set(null);
      },
      error: () => this.error.set(this.language.t('settings.loadFailed')),
    });
  }

  setLookback(value: string): void {
    const lookback = value === 'all' ? 'all' : '12months';
    this.rules.update((current) => ({ ...current, lookback }));
  }

  patchCounter(key: 'noShow' | 'lateCancellation' | 'lateArrival', partial: Partial<Counter>): void {
    this.rules.update((current) => ({ ...current, [key]: { ...current[key], ...partial } }));
  }

  save(): void {
    this.saving.set(true);
    const sent = this.rules();
    this.api.put('settings/me/reliability', sent).subscribe({
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
