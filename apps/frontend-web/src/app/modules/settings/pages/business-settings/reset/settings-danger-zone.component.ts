import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { SettingsResetDialogComponent } from './settings-reset-dialog.component';

/** The danger zone at the bottom of /settings: reset every setting to its factory value. */
@Component({
  selector: 'app-settings-danger-zone',
  standalone: true,
  imports: [TranslatePipe, SettingsResetDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="danger-zone" aria-labelledby="settings-danger-title">
      <div class="danger-zone-text">
        <h2 class="danger-zone-title" id="settings-danger-title">{{ 'settings.resetZoneTitle' | translate }}</h2>
        <p class="danger-zone-hint">{{ 'settings.resetZoneText' | translate }}</p>
      </div>
      <button type="button" class="danger-zone-btn" (click)="open.set(true)">
        {{ 'settings.resetZoneButton' | translate }}
      </button>
    </section>
    <app-settings-reset-dialog scope="all" [(visible)]="open" />
  `,
  styles: `
    :host {
      display: block;
    }

    .danger-zone {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem 1.5rem;
      padding: 1rem 1.25rem;
      border: 1px solid color-mix(in srgb, var(--color-danger) 45%, var(--border-color));
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, var(--color-danger) 5%, var(--bg-card));
    }

    .danger-zone-text {
      flex: 1 1 18rem;
      min-width: 0;
    }

    .danger-zone-title {
      margin: 0;
      color: var(--text-primary);
      font-size: 1rem;
      font-weight: 700;
    }

    .danger-zone-hint {
      margin: 0.25rem 0 0;
      color: var(--text-secondary);
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .danger-zone-btn {
      min-block-size: 2.75rem;
      padding: 0 1.25rem;
      border: 1px solid #b42318;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--text-primary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .danger-zone-btn:hover {
      background: #b42318;
      color: #fff;
    }

    .danger-zone-btn:focus-visible {
      outline: 2px solid #b42318;
      outline-offset: 2px;
    }
  `,
})
export class SettingsDangerZoneComponent {
  readonly open = signal(false);
}
