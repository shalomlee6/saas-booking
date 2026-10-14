import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { PublicApiService } from '../../services/public-api.service';
import { calendarDayInTimezone, daysUntilCalendarDate } from '../../dto/public-booking-dto.adapter';
import { PublicAppointmentCardComponent } from './public-appointment-card.component';
import { PublicAppointmentDetailsComponent } from '../public-appointment-details/public-appointment-details.component';

const noShow = {
  id: 'apt-1',
  date: '2026-01-02',
  time: '10:00',
  status: 'no_show',
  serviceName: 'Haircut',
};

describe('public appointment dates', () => {
  it('counts the visit from the business calendar day', () => {
    const now = new Date('2026-06-14T22:30:00.000Z');
    expect(daysUntilCalendarDate('2026-06-15', now, 'Asia/Jerusalem')).toBe(0);
    expect(daysUntilCalendarDate('2026-06-15', now, 'UTC')).toBe(1);
    const today = calendarDayInTimezone(now, 'Asia/Jerusalem');
    expect(today.getFullYear()).toBe(2026);
    expect(today.getMonth()).toBe(5);
    expect(today.getDate()).toBe(15);
  });
});

describe('public appointment no_show', () => {
  it('renders the translated label and does not offer edit', () => {
    TestBed.configureTestingModule({
      imports: [PublicAppointmentCardComponent],
      providers: [provideNoopAnimations()],
    });
    const language = TestBed.inject(LanguageService);
    language.setLanguage('en');
    const fixture = TestBed.createComponent(PublicAppointmentCardComponent);
    fixture.componentRef.setInput('apt', noShow);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No-show');
    expect(fixture.componentInstance.canEdit()).toBeFalse();
    expect(fixture.componentInstance.statusSeverity()).toBe('secondary');
    expect((fixture.nativeElement as HTMLElement).querySelector('.public-apt-edit')).toBeNull();
  });

  it('does not allow the client to cancel a no-show', () => {
    TestBed.configureTestingModule({
      imports: [PublicAppointmentDetailsComponent],
      providers: [
        provideNoopAnimations(),
        MessageService,
        { provide: PublicApiService, useValue: { cancelAppointment: () => of(null) } },
      ],
    });
    const fixture = TestBed.createComponent(PublicAppointmentDetailsComponent);
    fixture.componentRef.setInput('appointment', noShow);
    fixture.detectChanges();

    expect(fixture.componentInstance.canCancel()).toBeFalse();
  });
});
