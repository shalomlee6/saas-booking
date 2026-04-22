import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '../../../../core/api/api.service';
import { MessageService } from 'primeng/api';

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

  readonly images = input<string[]>([]);
  readonly isOwner = input(false);

  readonly lightboxOpen = signal(false);
  readonly lightboxIndex = signal(0);

  readonly addDialogOpen = signal(false);
  readonly urlDraft = signal('');

  readonly lightboxSrc = computed(() => {
    const imgs = this.images();
    const i = this.lightboxIndex();
    return imgs[i] ?? null;
  });

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
    const next = [...this.images(), url];
    this.api.put<unknown>('settings/me/settings', { portfolioImages: next }).subscribe({
      next: () => {
        this.addDialogOpen.set(false);
        this.messages.add({ severity: 'success', summary: 'נשמר', detail: 'התמונה נוספה לגלריה' });
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
  }
}
