import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { SettingsResetService, type ResetScope } from './settings-reset.service';

/** What each scope resets, as translation keys. The server resets exactly these (see services/settingsReset.ts). */
const RESET_ITEMS: Record<Exclude<ResetScope, 'all'>, string[]> = {
  design: ['settings.resetItemAdminTheme', 'settings.resetItemPublicTheme'],
  booking: ['settings.resetItemBooking', 'settings.resetItemCancellation'],
  reliability: ['settings.resetItemReliability'],
  customers: ['settings.resetItemBirthday'],
};

const SCOPE_TITLE: Record<ResetScope, string> = {
  all: 'settings.resetZoneTitle',
  design: 'settings.sectionDesign',
  booking: 'settings.sectionBooking',
  reliability: 'settings.sectionReliability',
  customers: 'settings.sectionCustomers',
};

/** Words that confirm a full reset. The server accepts the same two. */
const CONFIRM_WORDS = ['איפוס', 'reset'];

@Component({
  selector: 'app-settings-reset-dialog',
  standalone: true,
  imports: [DialogModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="title()"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closable]="!working()"
      [closeOnEscape]="!working()"
      [style]="{ width: '30rem', maxWidth: 'calc(100vw - 2rem)' }"
      [closeAriaLabel]="'common.cancel' | translate"
      appendTo="body"
      styleClass="settings-reset-dialog"
    >
      <div class="reset-body">
        <p class="reset-lead">
          {{ (scope() === 'all' ? 'settings.resetDialogLeadAll' : 'settings.resetDialogLeadSection') | translate }}
        </p>

        <h3 class="reset-heading">{{ 'settings.resetWillReset' | translate }}</h3>
        <ul class="reset-list">
          @for (key of items(); track key) {
            <li>{{ key | translate }}</li>
          }
        </ul>

        <h3 class="reset-heading">{{ 'settings.resetWillKeep' | translate }}</h3>
        <p class="reset-keep">{{ 'settings.resetKeepList' | translate }}</p>

        @if (needsTyping()) {
          <div class="reset-confirm">
            <label class="reset-confirm-label" for="settings-reset-confirm">
              {{ 'settings.resetTypeLabel' | translate: { word: confirmWord() } }}
            </label>
            <input
              id="settings-reset-confirm"
              class="reset-confirm-input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              [ngModel]="typed()"
              (ngModelChange)="typed.set($event)"
              [attr.aria-invalid]="typed().length > 0 && !typedOk()"
            />
          </div>
        }

        @if (error()) {
          <p class="reset-error" role="alert">{{ error() }}</p>
        }
      </div>

      <ng-template #footer>
        <div class="reset-actions">
          <button type="button" class="reset-btn reset-btn-ghost" [disabled]="working()" (click)="close()">
            {{ 'common.cancel' | translate }}
          </button>
          <button
            type="button"
            class="reset-btn reset-btn-danger"
            [disabled]="working() || !canConfirm()"
            (click)="confirm()"
          >
            {{ (working() ? 'settings.resetWorking' : 'settings.resetConfirm') | translate }}
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .reset-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      color: var(--text-primary);
    }

    .reset-lead {
      margin: 0 0 0.25rem;
      color: var(--text-secondary);
      font-size: 0.9375rem;
      line-height: 1.5;
    }

    .reset-heading {
      margin: 0.5rem 0 0;
      font-size: 0.875rem;
      font-weight: 700;
    }

    .reset-list {
      margin: 0;
      padding-inline-start: 1.25rem;
      font-size: 0.9375rem;
      line-height: 1.6;
    }

    .reset-keep {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.875rem;
      line-height: 1.55;
    }

    .reset-confirm {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin-block-start: 0.75rem;
    }

    .reset-confirm-label {
      font-size: 0.875rem;
      font-weight: 600;
    }

    .reset-confirm-input {
      box-sizing: border-box;
      min-block-size: 2.75rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border-color-strong, var(--border-color));
      border-radius: var(--radius-md);
      background: var(--bg-app);
      color: var(--text-primary);
      font: inherit;
    }

    .reset-confirm-input:focus-visible {
      outline: 2px solid var(--color-danger, #b42318);
      outline-offset: 1px;
    }

    .reset-error {
      margin: 0.5rem 0 0;
      padding: 0.625rem 0.75rem;
      border: 1px solid color-mix(in srgb, var(--color-danger, #b42318) 40%, var(--border-color));
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--color-danger, #b42318) 8%, var(--bg-card));
      font-size: 0.875rem;
    }

    .reset-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .reset-btn {
      min-block-size: 2.75rem;
      padding: 0 1.25rem;
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .reset-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .reset-btn:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .reset-btn-ghost {
      border-color: var(--border-color);
      background: transparent;
      color: var(--text-primary);
    }

    .reset-btn-danger {
      background: var(--danger-solid, #b42318);
      color: #fff;
    }
  `,
})
export class SettingsResetDialogComponent {
  private readonly service = inject(SettingsResetService);
  private readonly messages = inject(MessageService);
  private readonly language = inject(LanguageService);

  readonly scope = input.required<ResetScope>();
  readonly visible = model(false);

  readonly typed = signal('');
  readonly working = signal(false);
  readonly error = signal<string | null>(null);

  readonly needsTyping = computed(() => this.scope() === 'all');
  readonly title = computed(() => {
    const scope = this.scope();
    if (scope === 'all') return this.language.t(SCOPE_TITLE.all);
    return this.language.t('settings.resetDialogSectionTitle', { section: this.language.t(SCOPE_TITLE[scope]) });
  });
  readonly items = computed(() => {
    const scope = this.scope();
    return scope === 'all' ? Object.values(RESET_ITEMS).flat() : RESET_ITEMS[scope];
  });
  readonly confirmWord = computed(() => (this.language.language() === 'en' ? 'reset' : 'איפוס'));
  readonly typedOk = computed(() => CONFIRM_WORDS.includes(this.typed().trim().toLowerCase()));
  readonly canConfirm = computed(() => !this.needsTyping() || this.typedOk());

  close(): void {
    if (this.working()) return;
    this.visible.set(false);
    this.typed.set('');
    this.error.set(null);
  }

  confirm(): void {
    if (!this.canConfirm() || this.working()) return;
    this.working.set(true);
    this.error.set(null);
    this.service.reset(this.scope(), this.needsTyping() ? this.typed().trim() : undefined).subscribe({
      next: () => {
        this.working.set(false);
        this.messages.add({ severity: 'success', summary: this.language.t('settings.resetDone') });
        this.visible.set(false);
        this.typed.set('');
      },
      error: () => {
        this.working.set(false);
        this.error.set(this.language.t('settings.resetFailed'));
      },
    });
  }
}
