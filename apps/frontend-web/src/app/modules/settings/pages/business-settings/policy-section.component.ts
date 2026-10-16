import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../../../core/api/api.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-policy-section',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './policy-section.component.html',
  styleUrl: './settings-section.scss',
})
export class PolicySectionComponent {
  private readonly api = inject(ApiService);
  readonly language = inject(LanguageService);
  readonly policy = signal<{ he: string; en: string } | null>(null);
  readonly error = signal<string | null>(null);
  readonly text = computed(() => {
    const value = this.policy();
    if (!value) return '';
    return this.language.language() === 'en' ? value.en : value.he;
  });

  constructor() {
    this.api.get<{ clientPolicy: { he: string; en: string } }>('settings/me/booking-rules').subscribe({
      next: (body) => this.policy.set(body.clientPolicy),
      error: () => this.error.set(this.language.t('settings.loadFailed')),
    });
  }
}
