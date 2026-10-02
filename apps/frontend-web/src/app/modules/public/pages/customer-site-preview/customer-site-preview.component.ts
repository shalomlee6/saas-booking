import { Component, inject, computed, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../../core/auth/auth.service';
import { DOCUMENT } from '@angular/common';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

type PreviewDevice = 'mobile' | 'tablet' | 'desktop';

@Component({
  selector: 'app-customer-site-preview',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './customer-site-preview.component.html',
  styleUrl: './customer-site-preview.component.scss',
})
export class CustomerSitePreviewComponent {
  private readonly auth = inject(AuthService);
  private readonly doc = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);

  readonly business = this.auth.business;
  readonly slug = computed(() => this.auth.business()?.slug ?? null);
  readonly device = signal<PreviewDevice>('mobile');

  readonly devices: { id: PreviewDevice; icon: string; labelKey: string; width: string }[] = [
    { id: 'mobile', icon: 'pi pi-mobile', labelKey: 'navigation.previewMobile', width: '375px' },
    { id: 'tablet', icon: 'pi pi-tablet', labelKey: 'navigation.previewTablet', width: '768px' },
    { id: 'desktop', icon: 'pi pi-desktop', labelKey: 'navigation.previewDesktop', width: '100%' },
  ];

  readonly frameWidth = computed(
    () => this.devices.find((option) => option.id === this.device())?.width ?? '100%'
  );

  /** Same-origin URL for the iframe so the customer site loads inside the admin. */
  readonly iframeSrc = computed<SafeResourceUrl | null>(() => {
    const slug = this.slug();
    const origin = this.doc.defaultView?.location?.origin ?? '';
    const url = slug ? `${origin}/b/${encodeURIComponent(slug)}/login` : null;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  selectDevice(id: PreviewDevice): void {
    this.device.set(id);
  }
}
