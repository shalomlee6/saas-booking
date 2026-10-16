import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import type { PublicLandingProductItem } from '../../../../services/public-api.service';

@Component({
  selector: 'app-public-landing-products',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, TranslatePipe],
  templateUrl: './public-landing-products.component.html',
  styleUrl: './public-landing-products.component.scss',
})
export class PublicLandingProductsComponent {
  readonly products = input<PublicLandingProductItem[]>([]);
}
