import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { SettingsResetDialogComponent } from './settings-reset-dialog.component';
import type { ResetScope } from './settings-reset.service';

/** "Restore defaults" for one section, with a dialog that lists exactly what changes. */
@Component({
  selector: 'app-settings-section-reset',
  standalone: true,
  imports: [TranslatePipe, SettingsResetDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section-reset">
      <button type="button" class="section-reset-btn" (click)="open.set(true)">
        <i class="pi pi-history" aria-hidden="true"></i>
        {{ 'settings.resetSectionButton' | translate }}
      </button>
    </div>
    <app-settings-reset-dialog [scope]="scope()" [(visible)]="open" />
  `,
  styles: `
    :host {
      display: block;
    }

    .section-reset {
      display: flex;
      justify-content: flex-end;
    }

    .section-reset-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      min-block-size: 2.75rem;
      padding: 0 0.75rem;
      border: 0;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--text-secondary);
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
    }

    .section-reset-btn:hover {
      background: color-mix(in srgb, var(--text-primary) 6%, transparent);
      color: var(--text-primary);
    }

    .section-reset-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  `,
})
export class SettingsSectionResetComponent {
  readonly scope = input.required<Exclude<ResetScope, 'all'>>();
  readonly open = signal(false);
}
