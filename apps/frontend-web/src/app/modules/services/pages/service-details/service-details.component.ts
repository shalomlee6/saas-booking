import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ServicesApiService } from '../../services/services-api.service';
import type { Service } from '../../model/service';

@Component({
  selector: 'app-service-details',
  standalone: true,
  imports: [RouterLink, DecimalPipe, TranslatePipe],
  templateUrl: './service-details.component.html',
  styleUrl: './service-details.component.scss',
})
export class ServiceDetailsComponent implements OnInit {
  private readonly api = inject(ServicesApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly service = signal<Service | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }
    this.api.getById(id).subscribe({
      next: (service) => {
        this.service.set(service);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
