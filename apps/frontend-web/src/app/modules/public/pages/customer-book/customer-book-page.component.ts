import {
  Component,
  inject,
  OnInit,
  computed,
  signal,
  WritableSignal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { DatePickerModule } from 'primeng/datepicker';
import { SkeletonModule } from 'primeng/skeleton';
import {
  PublicApiService,
  type PublicBusinessForBooking,
  type PublicService,
  type CreateAppointmentBody,
} from '../../services/public-api.service';
import { HoldToConfirmButtonComponent } from './hold-to-confirm-button.component';

@Component({
  selector: 'app-customer-book-page',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DrawerModule,
    DatePickerModule,
    SkeletonModule,
    HoldToConfirmButtonComponent,
  ],
  templateUrl: './customer-book-page.component.html',
  styleUrl: './customer-book-page.component.scss',
})
export class CustomerBookPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicApi = inject(PublicApiService);
  private readonly messageService = inject(MessageService);

  readonly business = signal<PublicBusinessForBooking | null>(null);
  readonly services = signal<PublicService[]>([]);
  readonly selectedService = signal<PublicService | null>(null);
  readonly selectedDate = signal<Date | null>(null);
  readonly slots = signal<string[]>([]);
  readonly selectedSlot = signal<string | null>(null);
  readonly loadingBusiness = signal(true);
  readonly loadingServices = signal(true);
  readonly loadingSlots = signal(false);
  readonly drawerVisible = signal(false);
  readonly submitting = signal(false);
  readonly appointmentSuccess = signal(false);

  readonly slug = computed(() => {
    // return this.router.url.split('/')[2] ?? '';
    return   this.route.parent?.parent?.snapshot.paramMap.get('slug') ?? '';
  });
  readonly minDate = computed(() => new Date());

  readonly canShowSlots = computed(() => {
    return this.selectedDate() !== null && this.selectedService() !== null;
  });

  readonly canShowHoldButton = computed(() => {
    return (
      this.selectedService() !== null &&
      this.selectedDate() !== null &&
      this.selectedSlot() !== null
    );
  });

  readonly selectedDateStr = computed(() => {
    const d = this.selectedDate();
    if (!d) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  });

  get selectedDateValue(): Date | null {
    return this.selectedDate();
  }
  set selectedDateValue(v: Date | null) {
    this.selectedDate.set(v);
  }

  ngOnInit(): void {
    const slug = this.slug();
    if (!slug) {
      this.loadingBusiness.set(false);
      this.loadingServices.set(false);
      this.showError('חסר מזהה עסק');
      return;
    }
    this.loadBusiness(slug);
    this.loadServices(slug);
  }

  private loadBusiness(slug: string): void {
    this.loadingBusiness.set(true);
    this.publicApi.getBusinessForBooking(slug).subscribe({
      next: (data) => {
        this.business.set(data);
        this.loadingBusiness.set(false);
      },
      error: (err) => {
        this.loadingBusiness.set(false);
        this.showError(err?.error?.message ?? 'שגיאה בטעינת העסק');
      },
    });
  }

  private loadServices(slug: string): void {
    this.loadingServices.set(true);
    this.publicApi.getServices(slug).subscribe({
      next: (data) => {
        this.services.set(data);
        this.loadingServices.set(false);
      },
      error: (err) => {
        this.loadingServices.set(false);
        this.showError(err?.error?.message ?? 'שגיאה בטעינת השירותים');
      },
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'שגיאה',
      detail: message,
      life: 5000,
    });
  }

  openCalendarDrawer(service: PublicService): void {
    this.selectedService.set(service);
    this.selectedDate.set(null);
    this.slots.set([]);
    this.selectedSlot.set(null);
    this.drawerVisible.set(true);
  }

  closeDrawer(): void {
    this.drawerVisible.set(false);
  }

  onDateSelect(): void {
    const slug = this.slug();
    const service = this.selectedService();
    const date = this.selectedDate();
    if (!slug || !service || !date) return;
    const dateStr = this.selectedDateStr();
    this.loadingSlots.set(true);
    this.publicApi.getAvailability(slug, service.id, dateStr).subscribe({
      next: (res) => {
        this.slots.set(res.slots);
        this.selectedSlot.set(null);
        this.loadingSlots.set(false);
        this.closeDrawer();
      },
      error: (err) => {
        this.loadingSlots.set(false);
        this.showError(err?.error?.message ?? 'שגיאה בטעינת השעות');
      },
    });
  }

  selectSlot(slot: string): void {
    this.selectedSlot.set(slot);
  }

  onHoldConfirm(): void {
    const b = this.business();
    const service = this.selectedService();
    const dateStr = this.selectedDateStr();
    const time = this.selectedSlot();
    if (!b || !service || !dateStr || !time) return;
    this.submitting.set(true);
    const body: CreateAppointmentBody = {
      businessId: b.id,
      serviceId: service.id,
      date: dateStr,
      time,
    };
    this.publicApi.createAppointment(body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.appointmentSuccess.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.showError(err?.error?.message ?? 'שגיאה באישור התור');
      },
    });
  }

  goBack(): void {
    const slug = this.slug();
    if (slug) this.router.navigate(['/b', slug]);
  }
}
