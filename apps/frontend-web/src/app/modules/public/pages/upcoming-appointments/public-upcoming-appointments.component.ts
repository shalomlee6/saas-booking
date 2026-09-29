import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { distinctUntilChanged, map } from 'rxjs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { PublicAppointmentCardComponent } from '../../components/public-appointment-card/public-appointment-card.component';
import { PublicAppointmentDetailsComponent } from '../../components/public-appointment-details/public-appointment-details.component';
import { PublicApiService, type UpcomingAppointment } from '../../services/public-api.service';
import { PublicSessionService } from '../../services/public-session.service';
import { readBusinessSlugFromPathFromRoot } from '../../utils/public-route-snapshot.util';
import { sortUpcomingAppointments } from '../../utils/upcoming-appointments.util';

@Component({
  selector: 'app-public-upcoming-appointments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, SkeletonModule, TranslatePipe, PublicAppointmentCardComponent, PublicAppointmentDetailsComponent],
  templateUrl: './public-upcoming-appointments.component.html',
  styleUrl: './public-upcoming-appointments.component.scss',
})
export class PublicUpcomingAppointmentsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicApi = inject(PublicApiService);
  private readonly session = inject(PublicSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly language = inject(LanguageService);

  readonly slug = computed(() => readBusinessSlugFromPathFromRoot(this.route));
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly appointments = signal<UpcomingAppointment[]>([]);
  readonly selected = signal<UpcomingAppointment | null>(null);

  constructor() {
    // Re-fetch whenever the logged-in identity changes (login/logout/switching customer)
    // rather than only on a route change — this page's data is scoped to whoever is
    // currently signed in, not to the route by itself.
    let prevCustomerId: string | null | undefined;
    effect(() => {
      const currentId = this.session.customerId();
      if (prevCustomerId !== undefined && prevCustomerId !== currentId) {
        untracked(() => this.loadAppointments());
      }
      prevCustomerId = currentId;
    });
  }

  ngOnInit(): void {
    this.route.parent!.paramMap
      .pipe(
        map((p) => p.get('slug') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.loadAppointments());
  }

  loadAppointments(): void {
    const slug = this.slug();
    if (!slug || !this.session.hasSessionFor(slug)) {
      this.appointments.set([]);
      this.error.set(false);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(false);
    this.publicApi.getUpcomingAppointment().subscribe({
      next: (res) => {
        const list = res.appointments ?? (res.appointment ? [res.appointment] : []);
        this.appointments.set(sortUpcomingAppointments(list));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  goHome(): void {
    const slug = this.slug();
    if (slug) void this.router.navigate(['/b', slug]);
  }

  goToBook(): void {
    const slug = this.slug();
    if (slug) void this.router.navigate(['/b', slug, 'book']);
  }

  openDetails(apt: UpcomingAppointment): void {
    this.selected.set(apt);
  }

  onEdit(apt: UpcomingAppointment): void {
    this.selected.set(null);
    const slug = this.slug();
    if (!slug) return;
    const serviceId = apt.serviceId;
    if (serviceId) {
      void this.router.navigate(['/b', slug, 'book'], {
        queryParams: { service: serviceId },
      });
      return;
    }
    void this.router.navigate(['/b', slug, 'book']);
  }
}
