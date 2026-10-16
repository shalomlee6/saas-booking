import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** Sticky footer for a settings form: shows whether there is anything to save and holds the submit button. */
@Component({
  selector: 'app-settings-save-bar',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="save-bar" [class.save-bar-dirty]="dirty()">
      <p class="save-bar-status" role="status">
        <i [class]="dirty() ? 'pi pi-circle-fill' : 'pi pi-check-circle'" aria-hidden="true"></i>
        <span>{{ (dirty() ? 'settings.unsavedChanges' : 'settings.allSaved') | translate }}</span>
      </p>
      <button type="submit" class="save-bar-button" [disabled]="saving() || !dirty()">
        {{ (saving() ? 'common.saving' : 'settings.saveChanges') | translate }}
      </button>
    </div>
  `,
  styles: `
    :host {
      position: sticky;
      inset-block-end: 0;
      z-index: 5;
      display: block;
      margin-block-start: 0.5rem;
    }

    .save-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      box-shadow: 0 -6px 16px -8px color-mix(in srgb, var(--text-primary) 25%, transparent);
    }

    .save-bar-dirty {
      border-color: color-mix(in srgb, var(--color-primary) 40%, var(--border-color));
    }

    .save-bar-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      min-inline-size: 0;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .save-bar-status i {
      flex: 0 0 auto;
      font-size: 0.75rem;
      color: var(--color-success);
    }

    .save-bar-dirty .save-bar-status {
      color: var(--text-primary);
      font-weight: 600;
    }

    .save-bar-dirty .save-bar-status i {
      color: var(--color-primary);
      font-size: 0.5rem;
    }

    .save-bar-button {
      flex: 0 0 auto;
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

    .save-bar-button:hover:not(:disabled) {
      background: var(--color-primary-hover, var(--color-primary));
    }

    .save-bar-button:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .save-bar-button:disabled {
      background: color-mix(in srgb, var(--text-primary) 10%, var(--bg-card));
      color: var(--text-secondary);
      cursor: not-allowed;
    }

    @media (max-width: 480px) {
      .save-bar {
        padding: 0.625rem 0.75rem;
      }

      .save-bar-button {
        padding: 0 1rem;
      }
    }
  `,
})
export class SettingsSaveBarComponent {
  readonly dirty = input.required<boolean>();
  readonly saving = input(false);
}
