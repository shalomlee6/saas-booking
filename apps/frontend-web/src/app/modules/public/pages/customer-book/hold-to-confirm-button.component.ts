import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/**
 * Single-press confirm. A press-and-hold was not operable by keyboard
 * (WCAG 2.1.1) and required a path-based gesture (2.5.1).
 */
@Component({
  selector: 'app-hold-to-confirm-button',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './hold-to-confirm-button.component.html',
  styleUrl: './hold-to-confirm-button.component.scss',
})
export class HoldToConfirmButtonComponent {
  disabled = input<boolean>(false);
  confirm = output<void>();
}
