import { Component, inject, computed } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../../core/auth/auth.service';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-customer-site-preview',
  standalone: true,
  templateUrl: './customer-site-preview.component.html',
  styleUrl: './customer-site-preview.component.scss',
})
export class CustomerSitePreviewComponent {
  private readonly auth = inject(AuthService);
  private readonly doc = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);

  readonly business = this.auth.business;
  readonly slug = computed(() => this.auth.business()?.slug ?? null);

  /** Same-origin URL for the iframe so the customer site loads inside the admin. */
  readonly iframeSrc = computed<SafeResourceUrl | null>(() => {
    const slug = this.slug();
    const origin = this.doc.defaultView?.location?.origin ?? '';
    const url = slug ? `${origin}/b/${encodeURIComponent(slug)}/login` : null;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
}
