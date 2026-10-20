import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { CustomerBookPageComponent } from './customer-book-page.component';
import {
  PublicApiService,
  type MonthAvailabilityResponse,
  type PublicBusinessForBooking,
  type PublicService,
} from '../../services/public-api.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { DEFAULT_PUBLIC_TIMEZONE, calendarDayInTimezone, dateKeyFromPicker } from '../../dto/public-booking-dto.adapter';

const BUSINESS = {
  id: 'biz-1',
  name: 'Salon',
  openingHours: {},
  media: { photos: [] },
  cancellationNoticeHe: '',
} as PublicBusinessForBooking;

const SERVICE: PublicService = { id: 'svc-1', nameHe: 'תספורת', durationMinutes: 60, price: 100 };

function key(date: Date): string {
  return dateKeyFromPicker(date);
}

/** The salon: closed on Saturdays; its third open day is fully booked; bookable for 60 days. */
function salonDays(): { open: string[]; bookable: string[]; fullDay: string } {
  const today = calendarDayInTimezone(new Date(), DEFAULT_PUBLIC_TIMEZONE);
  const open: string[] = [];
  for (let offset = 0; offset <= 60; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    if (day.getDay() !== 6) open.push(key(day));
  }
  const fullDay = open[2];
  return { open, bookable: open.filter((day) => day !== fullDay), fullDay };
}

describe('CustomerBookPageComponent date step', () => {
  let fixture: ComponentFixture<CustomerBookPageComponent>;
  let component: CustomerBookPageComponent;
  let monthRequests: string[];
  let dayRequests: string[];
  let salon: ReturnType<typeof salonDays>;

  beforeEach(() => {
    salon = salonDays();
    monthRequests = [];
    dayRequests = [];
    const api = {
      getMonthAvailabilityByBusinessId: (_b: string, _s: string, month: string) => {
        monthRequests.push(month);
        const response: MonthAvailabilityResponse = {
          month,
          availableDays: salon.bookable.filter((day) => day.startsWith(month)),
          firstAvailable: salon.bookable.find((day) => day >= `${month}-01`) ?? null,
        };
        return of(response);
      },
      getAvailabilityByBusinessId: (_b: string, _s: string, date: string) => {
        dayRequests.push(date);
        return of({ date, slots: ['09:00', '10:00'], durationMinutes: 60, price: 100 });
      },
      getUpcomingAppointment: () => of({ appointment: null }),
    };

    TestBed.configureTestingModule({
      imports: [CustomerBookPageComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PublicApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { pathFromRoot: [] } },
      ],
    });
    fixture = TestBed.createComponent(CustomerBookPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.business.set(BUSINESS);
    component.selectedService.set(SERVICE);
    component.currentStep.set(3);
    fixture.detectChanges();
  });

  function showMonthOf(day: string): void {
    const [year, month] = day.split('-').map(Number);
    component.onMonthChange({ month, year });
    fixture.detectChanges();
  }

  function disabledKeys(): string[] {
    return component.disabledDates().map((date) => key(date));
  }

  it('preselects the first day that has slots and loads its times', () => {
    const first = salon.bookable[0];
    expect(key(component.selectedDate() as Date)).toBe(first);
    expect(dayRequests).toEqual([first]);
    expect(component.noDaysAvailable()).toBeFalse();
  });

  it('opens on the month of the first available day', () => {
    const [year, month] = salon.bookable[0].split('-').map(Number);
    expect(component.visibleMonth()).toEqual({ year, month: month - 1 });
  });

  it('disables a closed weekday (Saturday)', () => {
    const saturday = (() => {
      const today = calendarDayInTimezone(new Date(), DEFAULT_PUBLIC_TIMEZONE);
      for (let offset = 1; offset <= 14; offset++) {
        const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
        if (day.getDay() === 6) return key(day);
      }
      throw new Error('no Saturday found');
    })();
    showMonthOf(saturday);
    expect(disabledKeys()).toContain(saturday);
    // An ordinary open weekday of the same month is still selectable.
    const openDay = salon.bookable.find((day) => day.startsWith(saturday.slice(0, 7)) && day !== salon.bookable[0]);
    if (openDay) expect(disabledKeys()).not.toContain(openDay);
  });

  it('disables a fully booked day', () => {
    showMonthOf(salon.fullDay);
    expect(disabledKeys()).toContain(salon.fullDay);
    expect(disabledKeys()).not.toContain(salon.bookable[0]);
  });

  it('disables days beyond the booking horizon', () => {
    const beyond = salon.open[salon.open.length - 1];
    const next = new Date(Number(beyond.slice(0, 4)), Number(beyond.slice(5, 7)), 20); // a later month
    showMonthOf(key(next));
    const days = disabledKeys().filter((day) => day.startsWith(key(next).slice(0, 7)));
    expect(days.length).toBeGreaterThan(25); // practically the whole month
  });

  it('asks for each visible month only once', () => {
    const before = monthRequests.length;
    showMonthOf(salon.fullDay);
    showMonthOf(salon.bookable[0]);
    showMonthOf(salon.fullDay);
    const asked = monthRequests.slice(before);
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('announces every disabled day as unavailable, and no enabled day', () => {
    showMonthOf(salon.fullDay);
    const text = TestBed.inject(LanguageService).t('publicBook.dayUnavailable');
    const root: HTMLElement = fixture.nativeElement;
    const disabled = Array.from(root.querySelectorAll<HTMLElement>('.p-datepicker-day.p-disabled'));
    const enabled = Array.from(root.querySelectorAll<HTMLElement>('.p-datepicker-day:not(.p-disabled)'));
    expect(disabled.length).toBeGreaterThan(0);
    expect(enabled.length).toBeGreaterThan(0);
    for (const day of disabled) expect(day.querySelector('.sr-only')?.textContent?.trim()).toBe(text);
    for (const day of enabled) expect(day.querySelector('.sr-only')).toBeNull();
  });
});

describe('CustomerBookPageComponent with no bookable day', () => {
  it('shows a notice and selects nothing', () => {
    TestBed.configureTestingModule({
      imports: [CustomerBookPageComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PublicApiService,
          useValue: {
            getMonthAvailabilityByBusinessId: (_b: string, _s: string, month: string) =>
              of({ month, availableDays: [], firstAvailable: null } as MonthAvailabilityResponse),
            getAvailabilityByBusinessId: () => of({ date: '', slots: [], durationMinutes: 60, price: 0 }),
            getUpcomingAppointment: () => of({ appointment: null }),
          },
        },
        { provide: ActivatedRoute, useValue: { pathFromRoot: [] } },
      ],
    });
    const fixture = TestBed.createComponent(CustomerBookPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.business.set(BUSINESS);
    fixture.componentInstance.selectedService.set(SERVICE);
    fixture.componentInstance.currentStep.set(3);
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedDate()).toBeNull();
    expect(fixture.componentInstance.noDaysAvailable()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain(
      TestBed.inject(LanguageService).t('publicBook.noDaysAvailable')
    );
  });
});
