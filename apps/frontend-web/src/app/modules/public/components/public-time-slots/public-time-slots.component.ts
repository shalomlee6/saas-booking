import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** The bookable times of one day. Used by the booking page and by the client-site theme preview. */
@Component({
  selector: 'app-public-time-slots',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slots-grid" role="listbox" [attr.aria-label]="label()">
      @for (slot of slots(); track slot) {
        <button
          type="button"
          role="option"
          class="book-slot-btn"
          [class.book-slot-btn--selected]="selected() === slot"
          [attr.aria-selected]="selected() === slot"
          (click)="picked.emit(slot)"
        >
          {{ slot }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .slots-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.625rem;
    }

    @media (max-width: 360px) {
      .slots-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .book-slot-btn {
      padding: 0.875rem 0.5rem;
      border: 1.5px solid var(--border-color);
      border-radius: 9999px;
      background: var(--bg-card);
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      color: var(--text-primary);
      text-align: center;
      min-height: 52px;
      font-family: inherit;
      direction: ltr;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      transition:
        border-color 0.18s ease,
        background 0.18s ease,
        box-shadow 0.18s ease,
        transform 0.15s ease,
        color 0.18s ease;
    }

    .book-slot-btn:hover {
      border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
      box-shadow: 0 2px 10px color-mix(in srgb, var(--color-primary) 14%, transparent);
    }

    .book-slot-btn--selected {
      border-color: var(--color-primary);
      border-width: 2px;
      background: var(--color-primary-subtle);
      color: var(--color-primary-ink);
      font-weight: 700;
      box-shadow: 0 2px 12px color-mix(in srgb, var(--color-primary) 22%, transparent);
    }

    .book-slot-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .book-slot-btn:active {
      transform: scale(0.94);
    }
  `,
})
export class PublicTimeSlotsComponent {
  readonly slots = input.required<readonly string[]>();
  readonly selected = input<string | null>(null);
  /** Accessible name of the list. */
  readonly label = input('');
  readonly picked = output<string>();
}
