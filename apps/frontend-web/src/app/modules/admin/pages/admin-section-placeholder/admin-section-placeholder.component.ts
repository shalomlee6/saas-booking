import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-admin-section-placeholder',
  standalone: true,
  templateUrl: './admin-section-placeholder.component.html',
  styleUrl: './admin-section-placeholder.component.scss',
})
export class AdminSectionPlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  readonly vm = toSignal(
    this.route.data.pipe(
      map((d) => ({
        title: (d['adminTitle'] as string) ?? 'Section',
        subtitle: (d['adminSubtitle'] as string) ?? '',
      }))
    ),
    { initialValue: { title: 'Section', subtitle: '' } }
  );
}
