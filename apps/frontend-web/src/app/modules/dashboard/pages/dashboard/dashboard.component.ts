import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AppointmentsApiService } from '../../../appointments/services/appointments-api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ButtonModule, TagModule, AsyncPipe, DatePipe, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly appointmentsApi = inject(AppointmentsApiService);
  readonly appointments$ = this.appointmentsApi.appointments$;
}
