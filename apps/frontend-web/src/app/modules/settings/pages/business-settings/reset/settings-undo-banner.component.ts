import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { SettingsResetService } from './settings-reset.service';

/** Shown after a reset until the settings it covers change again: puts the previous values back. */
@Component({
  selector: 'app-settings-undo-banner',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="undo-banner" role="status">
        <i class="pi pi-info-circle" aria-hidden="true"></i>
        <p class="undo-banner-text">{{ 'settings.resetUndoText' | translate }}</p>
        <button type="button" class="undo-banner-btn" [disabled]="working()" (click)="restore()">
          {{ 'settings.resetUndoButton' | translate }}
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .undo-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
      padding: 0.75rem 1rem;
      border: 1px solid color-mix(in srgb, var(--color-primary) 40%, var(--border-color));
      border-radius: var(--radius-lg);
      background: var(--color-primary-subtle);
      color: var(--text-primary);
    }

    .undo-banner i {
      color: var(--color-primary-ink);
    }

    .undo-banner-text {
      flex: 1 1 14rem;
      margin: 0;
      font-size: 0.9375rem;
      line-height: 1.45;
    }

    .undo-banner-btn {
      min-block-size: 2.75rem;
      padding: 0 1.25rem;
      border: 0;
      border-radius: var(--radius-md);
      background: var(--color-primary);
      color: var(--on-primary, #fff);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .undo-banner-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .undo-banner-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  `,
})
export class SettingsUndoBannerComponent {
  private readonly service = inject(SettingsResetService);
  private readonly messages = inject(MessageService);
  private readonly language = inject(LanguageService);

  readonly visible = computed(() => this.service.status().available);
  readonly working = signal(false);

  restore(): void {
    if (this.working()) return;
    this.working.set(true);
    this.service.restore().subscribe({
      next: () => {
        this.working.set(false);
        this.messages.add({ severity: 'success', summary: this.language.t('settings.restoreDone') });
      },
      error: () => {
        this.working.set(false);
        this.service.refresh();
        this.messages.add({ severity: 'error', summary: this.language.t('settings.restoreFailed') });
      },
    });
  }
}
