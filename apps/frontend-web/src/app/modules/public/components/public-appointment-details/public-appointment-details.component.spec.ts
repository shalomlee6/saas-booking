import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { PublicApiService } from '../../services/public-api.service';
import { PublicAppointmentDetailsComponent } from './public-appointment-details.component';

const visit = {
  id: 'apt-1',
  date: '2026-11-15',
  time: '11:00',
  status: 'confirmed',
  serviceName: 'מניקור',
  serviceId: 's1',
};

describe('public appointment drawer', () => {
  function setup(canChange: boolean) {
    TestBed.configureTestingModule({
      imports: [PublicAppointmentDetailsComponent],
      providers: [
        provideNoopAnimations(),
        MessageService,
        { provide: PublicApiService, useValue: { cancelAppointment: () => of(null) } },
      ],
    });
    const language = TestBed.inject(LanguageService);
    language.setLanguage('he');
    const fixture = TestBed.createComponent(PublicAppointmentDetailsComponent);
    fixture.componentRef.setInput('appointment', { ...visit, canChange });
    fixture.componentRef.setInput('businessPhone', '050-123-4567');
    fixture.detectChanges();
    return fixture;
  }

  it('offers a new time and cancellation while the visit is still changeable', () => {
    const fixture = setup(true);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('קבעי מועד אחר');
    expect(text).toContain('האם את בטוחה שברצונך לבטל את התור?');
    expect(text.includes('לא ניתן לבטל או לשנות את התור באופן מקוון')).toBe(false);
    expect(fixture.componentInstance.canChange()).toBeTrue();
  });

  it('shows the contact message and hides the move and cancel actions outside the window', () => {
    const fixture = setup(false);
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain(
      'לא ניתן לבטל או לשנות את התור באופן מקוון. לביטול או שינוי, נא ליצור קשר עם העסק.'
    );
    expect(text).toContain('התקשרי לעסק');
    expect(text.includes('קבעי מועד אחר')).toBe(false);
    expect(text.includes('סיבת ביטול')).toBe(false);
    const call = root.querySelector('a.public-apt-details-call');
    expect(call?.getAttribute('href')).toBe('tel:0501234567');

    let edited = false;
    fixture.componentInstance.edit.subscribe(() => {
      edited = true;
    });
    fixture.componentInstance.onEdit();
    expect(edited).toBeFalse();
  });
});
