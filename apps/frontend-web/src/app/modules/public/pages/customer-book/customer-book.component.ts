import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-customer-book',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="customer-book">
      <h1 class="customer-book-title">Book</h1>
      <p class="customer-book-text">Choose a service and time.</p>
      <a [routerLink]="['/b', slug, 'login']" class="customer-book-back">Back to login</a>
    </div>
  `,
  styles: [
    `
      .customer-book {
        padding: 1.5rem;
        max-width: 430px;
        margin: 0 auto;
      }
      .customer-book-title {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
        color: var(--text-primary);
      }
      .customer-book-text {
        margin: 0 0 1rem;
        color: var(--text-muted);
      }
      .customer-book-back {
        color: var(--color-primary);
        font-size: 0.875rem;
      }
    `,
  ],
})
export class CustomerBookComponent {
  private readonly route = inject(ActivatedRoute);
  slug = this.route.parent?.parent?.snapshot.paramMap.get('slug') ?? '';
}
