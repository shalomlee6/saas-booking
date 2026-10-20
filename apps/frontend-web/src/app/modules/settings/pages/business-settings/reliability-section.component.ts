import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/api/api.service';
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

const DEFAULTS: ReliabilityRules = {
  noShow: { enabled: true, threshold: 3 },
  lateCancellation: { enabled: false, threshold: 3 },
  lateArrival: { enabled: false, threshold: 3 },
  lookback: '12months',
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
  readonly language = inject(LanguageService);
  readonly rules = signal<ReliabilityRules>(DEFAULTS);
  private readonly saved = signal<ReliabilityRules>(DEFAULTS);
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

  private load(): void {
    this.api.get<{ reliability: ReliabilityRules }>('settings/me/booking-rules').subscribe({
      next: (body) => {
        const loaded = { ...DEFAULTS, ...body.reliability };
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
