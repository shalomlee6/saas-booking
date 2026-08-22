import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '../../../../../../core/api/api.service';
import { MessageService } from 'primeng/api';
import type { PublicLandingGalleryItem } from '../../../../services/public-api.service';
import { resolvePublicAssetUrl } from '../../../../../../shared/utils/public-asset-url';

@Component({
  selector: 'app-public-landing-gallery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule],
  templateUrl: './public-landing-gallery.component.html',
  styleUrl: './public-landing-gallery.component.scss',
})
export class PublicLandingGalleryComponent {
  private readonly api = inject(ApiService);
  private readonly messages = inject(MessageService);

  readonly items = input<PublicLandingGalleryItem[]>([]);
  readonly isOwner = input(false);

  readonly lightboxOpen = signal(false);
  readonly lightboxIndex = signal(0);

  readonly addDialogOpen = signal(false);
  readonly urlDraft = signal('');

  readonly lightboxSrc = computed(() => {
    const imgs = this.items();
    const i = this.lightboxIndex();
    const raw = imgs[i]?.imageUrl ?? null;
    return raw ? resolvePublicAssetUrl(raw) : null;
  });

  readonly lightboxTitle = computed(() => {
    const imgs = this.items();
    const i = this.lightboxIndex();
    return imgs[i]?.title?.trim() ?? '';
  });

  displaySrc(url: string): string {
    return resolvePublicAssetUrl(url);
  }

  openLightbox(index: number): void {
    this.lightboxIndex.set(index);
    this.lightboxOpen.set(true);
  }

  openAddDialog(): void {
    this.urlDraft.set('');
    this.addDialogOpen.set(true);
  }

  submitNewImage(): void {
    const url = this.urlDraft().trim();
    if (!url) {
      this.messages.add({ severity: 'warn', summary: 'חסר קישור', detail: 'הזיני כתובת תמונה תקינה' });
      return;
    }
    this.api
      .get<{
        landingGalleryItems?: PublicLandingGalleryItem[];
        portfolioImages?: string[];
      }>('settings/me/settings')
      .subscribe({
        next: (s) => {
          let base: PublicLandingGalleryItem[] = [];
          if (s.landingGalleryItems && s.landingGalleryItems.length > 0) {
            base = s.landingGalleryItems.map((g) => ({
              id: g.id,
              imageUrl: g.imageUrl,
              title: g.title ?? '',
              type: g.type === 'product' ? 'product' : 'service',
            }));
          } else {
            base = (s.portfolioImages ?? []).map((u, i) => ({
              id: `legacy-${i}`,
              imageUrl: u,
              title: '',
              type: 'service' as const,
            }));
          }
          const newItem: PublicLandingGalleryItem = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `g-${Date.now()}`,
            imageUrl: url,
            title: '',
            type: 'service',
          };
          this.api.put<unknown>('settings/me/settings', { landingGalleryItems: [...base, newItem] }).subscribe({
            next: () => {
              this.addDialogOpen.set(false);
              this.messages.add({
                severity: 'success',
                summary: 'נשמר',
                detail: 'התמונה נוספה לגלריה',
              });
              window.location.reload();
            },
            error: (err: { error?: { message?: string } }) => {
              this.messages.add({
                severity: 'error',
                summary: 'שגיאה',
                detail: err?.error?.message ?? 'לא ניתן לשמור',
              });
            },
          });
        },
        error: (err: { error?: { message?: string } }) => {
          this.messages.add({
            severity: 'error',
            summary: 'שגיאה',
            detail: err?.error?.message ?? 'לא ניתן לטעון הגדרות',
          });
        },
      });
  }
}
