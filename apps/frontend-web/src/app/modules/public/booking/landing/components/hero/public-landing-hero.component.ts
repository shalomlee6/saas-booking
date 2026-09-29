import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CarouselModule } from 'primeng/carousel';

/** Default stock photos when the business has no media (matches prior landing behavior). */
export const PUBLIC_LANDING_DEFAULT_HERO_PHOTOS: readonly [string, string] = [
  'https://picsum.photos/800/400?random=1',
  'https://picsum.photos/800/400?random=2',
];

/**
 * The hero image slider only — business name/tagline/description/CTA moved
 * to `PublicLandingComponent`'s own template (see its `.pl-hero-intro`),
 * because the page-load intro animates them as part of the RISING content
 * together with everything below the hero, never as part of this slider's
 * own downward slide. Keeping them here would make it impossible to animate
 * the two groups as the single unit the intro needs — see
 * `PublicLandingComponent`'s `.pl-intro-rise`.
 */
@Component({
  selector: 'app-public-landing-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CarouselModule],
  templateUrl: './public-landing-hero.component.html',
  styleUrl: './public-landing-hero.component.scss',
})
export class PublicLandingHeroComponent {
  readonly imageLeft = input.required<string>();
  readonly imageRight = input.required<string>();
  /**
   * Plays the slider's own entrance (slide down + image depth-scale) once.
   * Container decides this per tenant/session — see `PublicLandingComponent`.
   * When false, the slider renders immediately in its final position.
   */
  readonly playEntrance = input(false);

  readonly carouselSlides = computed(() => {
    const a = this.imageLeft();
    const b = this.imageRight();
    if (a === b) {
      return [a];
    }
    return [a, b];
  });
}
