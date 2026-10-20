import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * One color row, the same pattern as the backoffice editor: a picker, a hex field and a few suggested
 * swatches, plus an optional warning. The value is only ever written as upper-case text; an unfinished
 * hex stays in the field (and marks it invalid) while the picker keeps showing the last good color.
 */
@Component({
  selector: 'app-color-field',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../business-settings/settings-section.scss',
  template: `
    <div class="settings-row theme-color-row">
      <div class="settings-row-text">
        <label class="settings-row-label" [id]="fieldId() + '-label'" [for]="fieldId()">{{ label() }}</label>
        <span class="settings-row-hint" [id]="fieldId() + '-hint'">{{ hint() }}</span>
      </div>
      <div class="settings-row-control">
        <span class="sr-only" [id]="fieldId() + '-pick'">{{ 'settings.pickColor' | translate }}</span>
        <input
          type="color"
          class="theme-color-picker"
          [attr.aria-labelledby]="fieldId() + '-pick ' + fieldId() + '-label'"
          [value]="swatch()"
          (input)="onPick($event)"
        />
        <input
          [id]="fieldId()"
          type="text"
          dir="ltr"
          maxlength="7"
          spellcheck="false"
          autocomplete="off"
          class="settings-input theme-hex-input"
          [ngModel]="value()"
          [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="set($event)"
          [attr.aria-invalid]="valid() ? null : 'true'"
          [attr.aria-describedby]="warning() ? fieldId() + '-hint ' + fieldId() + '-warning' : fieldId() + '-hint'"
        />
      </div>
      <div class="theme-presets" role="group" [attr.aria-label]="label()">
        @for (preset of presets(); track preset) {
          <button
            type="button"
            class="theme-preset"
            [style.background-color]="preset"
            [class.theme-preset-active]="current() === preset"
            [attr.aria-label]="'settings.presetColor' | translate: { color: preset }"
            [attr.aria-pressed]="current() === preset"
            (click)="set(preset)"
          ></button>
        }
      </div>
      @if (warning(); as text) {
        <p [id]="fieldId() + '-warning'" class="theme-warning" role="status">
          <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
          <span>{{ text }}</span>
        </p>
      }
    </div>
  `,
})
export class ColorFieldComponent {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly presets = input<readonly string[]>([]);
  /** Shown under the row, e.g. the contrast warning. */
  readonly warning = input<string | null>(null);
  /** What the picker shows while the hex field holds something that is not a color yet. */
  readonly fallback = input('#000000');
  readonly value = model('');

  readonly valid = computed(() => HEX.test(this.value()));
  readonly swatch = computed(() => (this.valid() ? this.value() : this.fallback()));
  readonly current = computed(() => this.value().toUpperCase());

  set(next: string): void {
    this.value.set(next.trim().toUpperCase());
  }

  onPick(event: Event): void {
    this.set((event.target as HTMLInputElement).value);
  }
}
