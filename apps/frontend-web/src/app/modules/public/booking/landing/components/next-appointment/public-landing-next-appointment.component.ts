import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { PublicAppointmentCardComponent } from '../../../../components/public-appointment-card/public-appointment-card.component';
import type { UpcomingAppointment } from '../../../../services/public-api.service';

@Component({
  selector: 'app-public-landing-next-appointment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, SkeletonModule, TranslatePipe, PublicAppointmentCardComponent],
  templateUrl: './public-landing-next-appointment.component.html',
  styleUrl: './public-landing-next-appointment.component.scss',
})
export class PublicLandingNextAppointmentComponent {
  readonly loading = input(false);
  readonly apt = input<UpcomingAppointment | null>(null);
  readonly error = input(false);
  readonly staffLine = input('');

  readonly book = output<void>();
  readonly open = output<void>();
  readonly edit = output<void>();
}
