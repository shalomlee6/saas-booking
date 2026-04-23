import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CarouselModule } from 'primeng/carousel';

/** Default stock photos when the business has no media (matches prior landing behavior). */
export const PUBLIC_LANDING_DEFAULT_HERO_PHOTOS: readonly [string, string] = [
  'https://picsum.photos/800/400?random=1',
  'https://picsum.photos/800/400?random=2',
];

@Component({
  selector: 'app-public-landing-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, CarouselModule],
  templateUrl: './public-landing-hero.component.html',
  styleUrl: './public-landing-hero.component.scss',
})
export class PublicLandingHeroComponent {
  readonly businessName = input.required<string>();
  readonly tagline = input.required<string>();
  /** Optional longer intro under the tagline. */
  readonly description = input('');
  readonly imageLeft = input.required<string>();
  readonly imageRight = input.required<string>();

  readonly carouselSlides = computed(() => {
    const a = this.imageLeft();
    const b = this.imageRight();
    if (a === b) {
      return [a];
    }
    return [a, b];
  });

  readonly book = output<void>();
}
