import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import type { Customer } from '../../../customers/model/customer';
import { CustomersApiService } from '../../../customers/services/customers-api.service';
import type { Service } from '../../../services/model/service';
import { ServicesApiService } from '../../../services/services/services-api.service';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { AppointmentFormComponent } from './appointment-form.component';

const CUSTOMER: Customer = {
  _id: 'c1',
  name: 'Noa Cohen',
  fullName: 'Noa Cohen',
  phone: '050-1234567',
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

const SERVICE: Service = {
  _id: 's1',
  name: 'Haircut',
  durationMinutes: 45,
  price: 120,
  isActive: true,
};

describe('AppointmentFormComponent', () => {
  let fixture: ComponentFixture<AppointmentFormComponent>;
  let component: AppointmentFormComponent;
  let blocked: boolean;

  function root(): HTMLElement {
    return fixture.nativeElement;
  }

  beforeEach(async () => {
    blocked = false;
    await TestBed.configureTestingModule({
      imports: [AppointmentFormComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        MessageService,
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: AppointmentsApiService, useValue: { create: () => of({}), refresh: () => undefined } },
        {
          provide: CustomersApiService,
          useValue: {
            getList: () => of([CUSTOMER]),
            getById: () => of({ ...CUSTOMER, blocked }),
          },
        },
        { provide: ServicesApiService, useValue: { list: () => of([SERVICE]) } },
        { provide: AuthService, useValue: { businessTimezone: () => 'Asia/Jerusalem' } },
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('en');
    fixture = TestBed.createComponent(AppointmentFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('groups the fields into three labelled sections under one heading', () => {
    expect(root().querySelectorAll('h1').length).toBe(1);
    const titles = [...root().querySelectorAll('.apt-form-section-title')].map((el) => el.textContent?.trim());
    expect(titles).toEqual(['Customer & service', 'Date & time', 'More details']);
    for (const section of root().querySelectorAll('.apt-form-section')) {
      expect(section.getAttribute('aria-labelledby')).toBeTruthy();
    }
  });

  it('lays the date and both times out on one shared grid', () => {
    const classes = [...root().querySelectorAll('.apt-field')].map((el) => el.className);
    expect(classes.filter((value) => value.includes('apt-field--time')).length).toBe(2);
    expect(classes.filter((value) => value.includes('apt-field--date')).length).toBe(1);
    expect(root().querySelector('.apt-form-card')?.classList.contains('p-fluid')).toBeTrue();
  });

  it('keeps Create disabled until the form is valid', () => {
    const create = root().querySelector('[data-testid="apt-create"]') as HTMLButtonElement;
    expect(create.disabled).toBeTrue();

    const day = new Date();
    day.setDate(day.getDate() + 1);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 45);
    component.form.patchValue({
      customer: CUSTOMER,
      serviceId: SERVICE._id,
      date: day,
      startTime: start,
      endTime: end,
    });
    fixture.detectChanges();
    expect(create.disabled).toBeFalse();
  });

  it('shows an announced error for every empty required field once touched', () => {
    expect(root().querySelectorAll('.apt-field-error').length).toBe(0);
    component.form.markAllAsTouched();
    fixture.detectChanges();
    const errors = [...root().querySelectorAll('.apt-field-error')];
    expect(errors.length).toBe(5);
    expect(errors.every((el) => el.getAttribute('role') === 'alert')).toBeTrue();
  });

  it('marks required labels with a decorative asterisk only', () => {
    const stars = [...root().querySelectorAll('.apt-req')];
    expect(stars.length).toBe(5);
    expect(stars.every((el) => el.getAttribute('aria-hidden') === 'true')).toBeTrue();
  });

  it('warns when the chosen customer is blocked from online booking', () => {
    expect(root().querySelector('.apt-alert--warning')).toBeNull();
    blocked = true;
    component.form.patchValue({ customer: CUSTOMER });
    fixture.detectChanges();
    const warning = root().querySelector('.apt-alert--warning');
    expect(warning?.getAttribute('role')).toBe('status');
  });

  it('fills the end time and price from the chosen service', () => {
    const start = new Date(2026, 9, 6, 9, 0);
    component.form.patchValue({ startTime: start, serviceId: SERVICE._id });
    component.onServiceChange();
    const end = component.form.get('endTime')?.value as Date;
    expect(end.getTime() - start.getTime()).toBe(45 * 60 * 1000);
    expect(component.form.get('price')?.value).toBe(120);
  });
});
