import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CarouselModule } from 'primeng/carousel';

@Component({
  selector: 'app-public-landing',
  standalone: true,
  imports: [ButtonModule, CarouselModule],
  templateUrl: './public-landing.component.html',
  styleUrl: './public-landing.component.scss',
})
export class PublicLandingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly customerName = 'אורח';

  readonly businessSlug = computed(() => {
    return this.route.parent?.snapshot.paramMap.get('slug') ?? '';
  });

  readonly carouselImages = [
    'https://picsum.photos/800/400?random=1',
    'https://picsum.photos/800/400?random=2',
    'https://picsum.photos/800/400?random=3',
  ];

  goToBook(): void {
    const slug = this.businessSlug();
    if (slug) {
      this.router.navigate(['/b', slug, 'book']);
    }
  }
}
