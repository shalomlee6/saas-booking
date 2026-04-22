import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import type { PublicLandingProductItem } from '../../services/public-api.service';

@Component({
  selector: 'app-public-landing-products',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  templateUrl: './public-landing-products.component.html',
  styleUrl: './public-landing-products.component.scss',
})
export class PublicLandingProductsComponent {
  readonly products = input<PublicLandingProductItem[]>([]);
}
