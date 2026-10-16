import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { PublicApiService } from '../../services/public-api.service';
import { readBusinessSlugFromPathFromRoot } from '../../utils/public-route-snapshot.util';

@Component({
  selector: 'app-public-accessibility-statement',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './public-accessibility-statement.component.html',
  styleUrl: './public-accessibility-statement.component.scss',
})
export class PublicAccessibilityStatementComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicApi = inject(PublicApiService);

  readonly phone = signal<string | null>(null);
  readonly email = signal<string | null>(null);
  readonly loaded = signal(false);

  ngOnInit(): void {
    const slug = readBusinessSlugFromPathFromRoot(this.route);
    if (!slug) return;
    this.publicApi.getBusinessLanding(slug).subscribe({
      next: (landing) => {
        const phone = landing.contact.phone?.trim();
        const email = landing.contact.email?.trim();
        this.phone.set(phone || null);
        this.email.set(email || null);
        this.loaded.set(true);
      },
      error: () => {
        this.phone.set(null);
        this.email.set(null);
        this.loaded.set(true);
      },
    });
  }

  phoneHref(): string | null {
    const raw = this.phone();
    if (!raw) return null;
    const digits = raw.replace(/[^\d+]/g, '');
    return digits ? `tel:${digits}` : null;
  }
}
