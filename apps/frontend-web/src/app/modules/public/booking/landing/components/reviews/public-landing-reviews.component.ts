import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { PublicLandingReviewItem } from '../../../../services/public-api.service';

function starRow(rating: number): string {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export interface PublicLandingReviewRow extends PublicLandingReviewItem {
  starRow: string;
}

@Component({
  selector: 'app-public-landing-reviews',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './public-landing-reviews.component.html',
  styleUrl: './public-landing-reviews.component.scss',
})
export class PublicLandingReviewsComponent {
  readonly reviews = input<PublicLandingReviewItem[]>([]);

  readonly rows = computed((): PublicLandingReviewRow[] =>
    this.reviews().map((r) => ({ ...r, starRow: starRow(r.rating) }))
  );
}
