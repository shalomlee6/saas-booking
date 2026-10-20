import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * The public site's top bar: the menu button and the site title on the brand color.
 * Used by the real site (inside the navigation) and by the client-site theme preview.
 */
@Component({
  selector: 'app-public-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="public-nav-topbar" role="banner">
      <button
        #menuBtn
        type="button"
        class="public-nav-menu-btn"
        [attr.aria-label]="menuLabel()"
        [attr.aria-expanded]="expanded()"
        [attr.aria-controls]="controls()"
        (click)="toggled.emit()"
      >
        <i [class]="icon()" aria-hidden="true"></i>
      </button>
      <span class="public-nav-topbar-title">{{ title() }}</span>
    </header>
  `,
  styles: `
    /* Sticks to the top of whatever contains it (the page, or the preview frame). Keep the height in step
       with $public-nav-topbar-height in public-customer-nav.component.scss. */
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .public-nav-topbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      height: 56px;
      padding: 0 0.75rem;
      /* --on-primary is the text color that is safe on a solid --color-primary fill (it can be dark for a
         pale brand color), so it is never hardcoded to white. */
      background: var(--color-primary);
      color: var(--on-primary);
      box-sizing: border-box;
    }

    .public-nav-topbar-title {
      position: absolute;
      inset-inline: 3.25rem;
      top: 50%;
      transform: translateY(-50%);
      text-align: center;
      font-size: 1.0625rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      pointer-events: none;
    }

    .public-nav-menu-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      height: 2.75rem;
      padding: 0;
      border: none;
      border-radius: var(--radius-md, 8px);
      background: transparent;
      color: var(--on-primary);
      cursor: pointer;
    }

    .public-nav-menu-btn:hover {
      background: color-mix(in srgb, var(--on-primary) 16%, transparent);
    }

    .public-nav-menu-btn:focus-visible {
      outline: 2px solid var(--on-primary);
      outline-offset: 2px;
    }

    .public-nav-menu-btn i {
      font-size: 1.25rem;
    }
  `,
})
export class PublicTopbarComponent {
  readonly title = input('boki');
  readonly menuLabel = input('');
  readonly icon = input('pi pi-bars');
  readonly expanded = input(false);
  /** Id of the menu this button opens (for aria-controls). */
  readonly controls = input<string | null>(null);
  readonly toggled = output<void>();

  private readonly button = viewChild<ElementRef<HTMLButtonElement>>('menuBtn');

  focusMenuButton(): void {
    this.button()?.nativeElement.focus();
  }
}
