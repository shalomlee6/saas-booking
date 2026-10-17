import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { PublicApiService } from '../../services/public-api.service';
import { PublicSessionService } from '../../services/public-session.service';
import { PublicCustomerNavComponent } from './public-customer-nav.component';

@Component({ standalone: true, template: '' })
class StubPageComponent {}

describe('PublicCustomerNavComponent logout', () => {
  let fixture: ComponentFixture<PublicCustomerNavComponent>;
  let router: Router;
  let session: PublicSessionService;
  let logout: jasmine.Spy;
  let main: HTMLElement;

  beforeEach(async () => {
    logout = jasmine.createSpy('logout').and.returnValue(of({ ok: true }));
    await TestBed.configureTestingModule({
      imports: [PublicCustomerNavComponent],
      providers: [
        provideRouter([
          { path: 'b/:slug', component: StubPageComponent },
          { path: 'b/:slug/book', component: StubPageComponent },
          { path: 'b/:slug/upcoming', component: StubPageComponent },
        ]),
        { provide: PublicApiService, useValue: { logoutPublicCustomer: logout } },
        {
          provide: ActivatedRoute,
          useValue: { pathFromRoot: [{ snapshot: { paramMap: { get: () => 'demo-salon' } } }] },
        },
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('en');
    router = TestBed.inject(Router);
    session = TestBed.inject(PublicSessionService);
    main = document.createElement('main');
    main.id = 'main-content';
    main.tabIndex = -1;
    document.body.appendChild(main);
    fixture = TestBed.createComponent(PublicCustomerNavComponent);
    fixture.detectChanges();
  });

  afterEach(() => main.remove());

  it('goes to the business home page, closes the menu, clears the session and focuses main', async () => {
    await router.navigateByUrl('/b/demo-salon/upcoming');
    session.rememberCustomerId('c1');
    fixture.componentInstance.toggleMenu();
    expect(fixture.componentInstance.menuOpen()).toBeTrue();
    const epoch = session.flowEpoch();

    fixture.componentInstance.onSwitchUser();
    await fixture.whenStable();

    expect(logout).toHaveBeenCalledOnceWith('demo-salon');
    expect(router.url).toBe('/b/demo-salon');
    expect(fixture.componentInstance.menuOpen()).toBeFalse();
    expect(document.body.classList.contains('public-nav-lock')).toBeFalse();
    expect(session.customerId()).toBeNull();
    expect(session.flowEpoch()).toBe(epoch + 1);
    expect(document.activeElement).toBe(main);
  });

  it('lists the accessibility statement in the side menu', () => {
    const hrefs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')].map((a) =>
      a.getAttribute('href')
    );
    expect(hrefs).toContain('/b/demo-salon/accessibility');
  });
});
