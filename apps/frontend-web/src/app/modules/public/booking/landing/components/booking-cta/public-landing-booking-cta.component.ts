import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-public-landing-booking-cta',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  templateUrl: './public-landing-booking-cta.component.html',
  styleUrl: './public-landing-booking-cta.component.scss',
})
export class PublicLandingBookingCtaComponent {
  readonly phone = input<string | null>(null);
  readonly whatsapp = input<string | null>(null);
  readonly email = input<string | null>(null);
  readonly location = input<string | null>(null);

  /** `tel:` href with digits only when possible */
  readonly phoneHref = computed((): string | null => {
    const p = this.phone();
    if (!p?.trim()) return null;
    const digits = p.replace(/\D/g, '');
    return digits.length > 0 ? `tel:${digits}` : null;
  });

  readonly whatsappHref = computed((): string | null => {
    const w = this.whatsapp()?.trim();
    if (!w) return null;
    const digits = w.replace(/\D/g, '');
    return digits.length > 0 ? `https://wa.me/${digits}` : null;
  });

  readonly emailHref = computed((): string | null => {
    const e = this.email()?.trim();
    if (!e) return null;
    return `mailto:${e}`;
  });

  readonly book = output<void>();
}
