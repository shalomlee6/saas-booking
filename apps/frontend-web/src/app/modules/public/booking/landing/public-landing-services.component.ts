import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import type { PublicService } from '../../services/public-api.service';

function serviceEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/פדיקור|רגל|רגליים/.test(name)) return '🦶';
  if (/לק|gel|ג'ל|ציפורן|מניקור/.test(n) || /מניקור/.test(name)) return '💅';
  if (/עיצוב|אמנות|art/.test(n)) return '✨';
  if (/שעווה|הסרת|פנים|פacial|עור/.test(n)) return '🌸';
  return '✨';
}

export interface PublicLandingServiceCardView extends PublicService {
  emoji: string;
}

@Component({
  selector: 'app-public-landing-services',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, ButtonModule],
  templateUrl: './public-landing-services.component.html',
  styleUrl: './public-landing-services.component.scss',
})
export class PublicLandingServicesComponent {
  readonly services = input<PublicService[]>([]);

  readonly bookService = output<string>();

  readonly cards = computed((): PublicLandingServiceCardView[] =>
    this.services().map((s) => ({
      ...s,
      emoji: serviceEmoji(s.nameHe),
    }))
  );
}
