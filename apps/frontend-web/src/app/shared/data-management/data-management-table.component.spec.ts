import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Subject, of, throwError } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { createdRangeForPreset } from './calendar-date';
import { DataManagementTableComponent } from './data-management-table.component';
import type {
  DataListPage,
  EntityDataManagementConfig,
} from './entity-data-management-config';

interface Row {
  id: string;
  name: string;
  email: string;
  note: string;
}

const ROWS: Row[] = [
  { id: '1', name: 'Ada', email: 'ada@example.com', note: 'Morning' },
  { id: '2', name: 'Bea', email: 'bea@example.com', note: 'Evening' },
];

function page(items: Row[], total = items.length): DataListPage<Row> {
  return { items, total, page: 1, limit: 25 };
}

function config(overrides: Partial<EntityDataManagementConfig<Row>> = {}): EntityDataManagementConfig<Row> {
  return {
    rowId: (row) => row.id,
    columns: [
      { id: 'name', header: 'Name', visibility: 'default', showOnSmallScreen: true, value: (row) => row.name },
      { id: 'email', header: 'Email', visibility: 'optional', showOnSmallScreen: false, value: (row) => row.email },
      { id: 'note', header: 'Note', visibility: 'default', showOnSmallScreen: false, value: (row) => row.note },
    ],
    searchFields: ['name', 'email'],
    filters: [
      {
        id: 'status',
        label: 'Status',
        kind: 'select',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
      { id: 'city', label: 'City', kind: 'text' },
    ],
    sorts: [
      { field: 'name', label: 'Name' },
      { field: 'email', label: 'Email' },
    ],
    rowActions: [],
    bulkActions: [
      {
        id: 'deactivate',
        label: 'Deactivate',
        consequence: 'They will be hidden from booking.',
        run: () => undefined,
      },
    ],
    permissions: { metrics: false, bulk: true, export: true },
    ...overrides,
  };
}

describe('DataManagementTableComponent', () => {
  let fixture: ComponentFixture<DataManagementTableComponent<Row>>;
  let component: DataManagementTableComponent<Row>;
  let gates: Subject<DataListPage<Row>>[];

  function loader() {
    const gate = new Subject<DataListPage<Row>>();
    gates.push(gate);
    return gate.asObservable();
  }

  function setup(cfg = config()): void {
    gates = [];
    fixture = TestBed.createComponent(DataManagementTableComponent<Row>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', cfg);
    fixture.componentRef.setInput('load', () => loader());
    fixture.detectChanges();
  }

  function text(testId: string): string {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`)?.textContent ?? '';
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataManagementTableComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('en');
  });

  it('debounces search and ignores a stale response', fakeAsync(() => {
    setup();
    expect(text('dm-loading')).toContain('Loading');
    expect(gates.length).toBe(1);

    component.searchDraft.set('ad');
    fixture.detectChanges();
    tick(299);
    expect(component.listQuery().search).toBe('');
    tick(1);
    fixture.detectChanges();
    expect(component.listQuery().search).toBe('ad');
    expect(component.listQuery().page).toBe(1);
    expect(gates.length).toBe(2);

    gates[1].next(page([ROWS[0]], 1));
    gates[0].next(page(ROWS, 2));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ada');
    expect(fixture.nativeElement.textContent).not.toContain('Bea');
    tick(300);
  }));

  it('tracks multiple filters, removing one and clearing all', fakeAsync(() => {
    setup();
    gates[0].next(page(ROWS, 2));
    fixture.detectChanges();

    component.setFilter('status', 'active');
    component.setFilter('city', 'Haifa');
    fixture.detectChanges();

    expect(component.activeFilterCount()).toBe(2);
    expect(component.listQuery().filters).toEqual({ status: 'active', city: 'Haifa' });
    expect(text('dm-active-count')).toContain('2');

    fixture.nativeElement.querySelector('[data-testid="dm-remove-city"]').click();
    fixture.detectChanges();
    expect(component.listQuery().filters).toEqual({ status: 'active' });

    fixture.nativeElement.querySelector('[data-testid="dm-clear-filters"]').click();
    fixture.detectChanges();
    expect(component.listQuery().filters).toEqual({});
    expect(component.listQuery().search).toBe('');
    expect(component.activeFilterCount()).toBe(0);
    tick(300);
  }));

  it('sends every activity preset and keeps a visit range alongside it', fakeAsync(() => {
    setup(
      config({
        filters: [
          {
            id: 'activity',
            label: 'Activity',
            kind: 'preset',
            options: [
              { value: 'noVisits', label: 'No visits', params: { activity: 'noVisits' } },
              { value: 'lastVisitOver30', label: 'Over 30', params: { activity: 'lastVisitOver30' } },
              { value: 'noUpcoming', label: 'No upcoming', params: { activity: 'noUpcoming' } },
            ],
          },
          {
            id: 'visits',
            label: 'Visits',
            kind: 'preset',
            options: [{ value: '2-5', label: '2–5', params: { visitsMin: '2', visitsMax: '6' } }],
          },
          {
            id: 'created',
            label: 'Created',
            kind: 'date-preset',
            fromId: 'createdFrom',
            toId: 'createdTo',
            options: [{ value: 'today', label: 'Today' }],
          },
        ],
      })
    );
    gates[0].next(page(ROWS, 2));
    fixture.detectChanges();

    component.setFilter('activity', 'noVisits');
    component.setFilter('visits', '2-5');
    expect(component.listQuery().filters).toEqual({
      activity: 'noVisits',
      visitsMin: '2',
      visitsMax: '6',
    });

    component.clearFilter('visits');
    component.setFilter('activity', 'lastVisitOver30');
    expect(component.listQuery().filters).toEqual({ activity: 'lastVisitOver30' });

    component.setFilter('activity', 'noUpcoming');
    expect(component.listQuery().filters).toEqual({ activity: 'noUpcoming' });

    component.setFilter('created', 'today');
    const created = createdRangeForPreset('today');
    expect(component.listQuery().filters).toEqual(
      created
        ? { activity: 'noUpcoming', createdFrom: created.from, createdTo: created.to }
        : { activity: 'noUpcoming' }
    );
    tick(300);
  }));

  it('sorts one column at a time and pages with 25/50/100', fakeAsync(() => {
    setup();
    gates[0].next(page(ROWS, 80));
    fixture.detectChanges();

    expect(component.listQuery().sort).toBe('name');
    expect(component.listQuery().order).toBe('asc');
    expect(component.listQuery().page).toBe(1);
    expect(component.listQuery().limit).toBe(25);

    fixture.nativeElement.querySelector('[data-testid="dm-sort-name"]').click();
    fixture.detectChanges();
    expect(component.listQuery().sort).toBe('name');
    expect(component.listQuery().order).toBe('desc');
    expect(component.listQuery().page).toBe(1);

    fixture.nativeElement.querySelector('[data-testid="dm-column-email"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="dm-sort-email"]').click();
    fixture.detectChanges();
    expect(component.listQuery().sort).toBe('email');
    expect(component.listQuery().order).toBe('asc');

    component.setPage(3);
    expect(component.listQuery().page).toBe(3);
    component.setLimit(50);
    expect(component.listQuery().page).toBe(1);
    expect(component.listQuery().limit).toBe(50);
    component.setLimit(100);
    expect(component.listQuery().limit).toBe(100);
    expect(component.pageSizes).toEqual([25, 50, 100]);
    tick(300);
  }));

  it('hides optional columns until selected, and marks desktop-only columns', fakeAsync(() => {
    setup();
    gates[0].next(page(ROWS, 2));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="dm-sort-name"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('ada@example.com');
    const emailToggle = fixture.nativeElement.querySelector('[data-testid="dm-column-email"]') as HTMLInputElement;
    expect(emailToggle.checked).toBe(false);

    emailToggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ada@example.com');

    const noteHeader = [...fixture.nativeElement.querySelectorAll('th')].find((cell: HTMLElement) =>
      cell.textContent?.includes('Note')
    ) as HTMLElement;
    expect(noteHeader.classList.contains('data-table-col-desktop')).toBe(true);
    const nameHeader = fixture.nativeElement.querySelector('[data-testid="dm-sort-name"]')
      .parentElement as HTMLElement;
    expect(nameHeader.classList.contains('data-table-col-desktop')).toBe(false);
    tick(300);
  }));

  it('selects rows and confirms a bulk action with count, action, and consequence', fakeAsync(() => {
    const run = jasmine.createSpy('run');
    setup(
      config({
        bulkActions: [
          {
            id: 'deactivate',
            label: 'Deactivate',
            consequence: 'They will be hidden from booking.',
            run,
          },
        ],
      })
    );
    gates[0].next(page(ROWS, 2));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="dm-row-1"]').click();
    fixture.detectChanges();
    expect(text('dm-bulk')).toContain('1 selected');

    fixture.nativeElement.querySelector('[data-testid="dm-bulk-deactivate"]').click();
    fixture.detectChanges();
    expect(text('dm-dialog-summary')).toContain('1 records');
    expect(text('dm-dialog-summary')).toContain('Deactivate');
    expect(text('dm-dialog-consequence')).toContain('hidden from booking');
    expect(run).not.toHaveBeenCalled();

    fixture.nativeElement.querySelector('[data-testid="dm-dismiss"]').click();
    fixture.detectChanges();
    expect(run).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="dm-dialog"]')).toBeNull();

    fixture.nativeElement.querySelector('[data-testid="dm-bulk-deactivate"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="dm-confirm"]').click();
    fixture.detectChanges();
    expect(run).toHaveBeenCalledOnceWith([ROWS[0]]);
    expect(component.selectedIds()).toEqual([]);
    tick(300);
  }));

  it('renders empty, no-results, and error with retry', fakeAsync(() => {
    gates = [];
    let fail = true;
    fixture = TestBed.createComponent(DataManagementTableComponent<Row>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', config());
    fixture.componentRef.setInput('load', () => {
      if (fail) return throwError(() => new Error('down'));
      return of(page([]));
    });
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    expect(text('dm-error')).toContain('could not be loaded');

    fail = false;
    fixture.nativeElement.querySelector('[data-testid="dm-retry"]').click();
    fixture.detectChanges();
    expect(text('dm-empty')).toContain('Nothing to show');

    component.setFilter('status', 'active');
    fixture.detectChanges();
    expect(text('dm-no-results')).toContain('No results');
    expect(fixture.nativeElement.querySelector('[data-testid="dm-no-results-clear"]')).not.toBeNull();

    fixture.nativeElement.querySelector('[data-testid="dm-no-results-clear"]').click();
    fixture.detectChanges();
    expect(component.listQuery().filters).toEqual({});
    expect(text('dm-empty')).toContain('Nothing to show');
    tick(300);
  }));

  it('renders the header, a filtered count, and runs the header actions', fakeAsync(() => {
    const settings = jasmine.createSpy('settings');
    const create = jasmine.createSpy('create');
    setup(
      config({
        title: 'People',
        countLabel: (total) => `${total} people`,
        headerActions: [{ id: 'settings', label: 'Settings', icon: 'pi pi-cog', run: settings }],
        primaryAction: { label: 'New person', icon: 'pi pi-plus', run: create },
      })
    );
    expect(text('dm-count')).toBe('');
    gates[0].next(page(ROWS, 142));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('People');
    expect(text('dm-count')).toContain('142 people');

    fixture.nativeElement.querySelector('[data-testid="dm-header-settings"]').click();
    fixture.nativeElement.querySelector('[data-testid="dm-primary"]').click();
    expect(settings).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    tick(300);
  }));

  it('shows an identity cell with initials, muted secondary text, and tone-coded tags', fakeAsync(() => {
    setup(
      config({
        columns: [
          {
            id: 'name',
            header: 'Name',
            visibility: 'default',
            showOnSmallScreen: true,
            avatar: true,
            value: (row) => row.name,
            secondary: (row) => row.email,
          },
          {
            id: 'note',
            header: 'Note',
            visibility: 'default',
            showOnSmallScreen: false,
            value: (row) => (row.id === '1' ? row.note : '—'),
            secondary: () => 'hint',
          },
          {
            id: 'state',
            header: 'State',
            visibility: 'default',
            showOnSmallScreen: true,
            value: () => '',
            tags: () => [{ label: 'Active', severity: 'success' }],
          },
        ],
      })
    );
    gates[0].next(
      page([{ id: '1', name: 'Ada Lovelace', email: 'ada@example.com', note: 'Morning' }, ROWS[1]], 2)
    );
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.data-table-avatar')?.textContent?.trim()).toBe('AL');
    expect(root.querySelector('.data-table-secondary')?.textContent).toContain('ada@example.com');
    expect(root.querySelector('.data-table-tag')?.getAttribute('data-tone')).toBe('success');

    const noteCells = [...root.querySelectorAll('tbody tr')].map(
      (row) => row.querySelectorAll('td')[2] as HTMLElement
    );
    expect(noteCells[0].textContent).toContain('hint');
    expect(noteCells[1].querySelector('.data-table-muted')).not.toBeNull();
    expect(noteCells[1].textContent).not.toContain('hint');
    tick(300);
  }));

  it('keeps quick filters out of the chips and the filters badge', fakeAsync(() => {
    setup(
      config({
        filters: [
          {
            id: 'status',
            label: 'Status',
            kind: 'segment',
            placement: 'quick',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ],
          },
          { id: 'city', label: 'City', kind: 'text', placement: 'drawer' },
        ],
        defaultFilters: { status: 'active' },
      })
    );
    gates[0].next(page(ROWS, 2));
    fixture.detectChanges();

    const segment = fixture.nativeElement.querySelector('[data-testid="dm-filter-status"]') as HTMLElement;
    expect(segment.querySelector('[aria-pressed="true"]')?.textContent).toContain('Active');

    component.setFilter('status', 'inactive');
    fixture.detectChanges();
    expect(component.listQuery().filters).toEqual({ status: 'inactive' });
    expect(fixture.nativeElement.querySelector('[data-testid="dm-remove-status"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="dm-active-count"]')).toBeNull();

    component.setFilter('city', 'Haifa');
    fixture.detectChanges();
    expect(text('dm-active-count')).toContain('1');
    expect(fixture.nativeElement.querySelector('[data-testid="dm-remove-city"]')).not.toBeNull();
    tick(300);
  }));

  it('summarises the visible range and collapses long page lists', fakeAsync(() => {
    setup();
    gates[0].next(page(ROWS, 142));
    fixture.detectChanges();
    expect(text('dm-summary')).toContain('Showing 1–25 of 142');
    expect(component.pageItems().map((item) => item.page)).toEqual([1, 2, null, 6]);

    component.setPage(3);
    fixture.detectChanges();
    gates[1].next(page(ROWS, 142));
    fixture.detectChanges();
    expect(text('dm-summary')).toContain('Showing 51–75 of 142');
    expect(component.pageItems().map((item) => item.page)).toEqual([1, 2, 3, 4, null, 6]);
    expect(fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('3');

    component.setPage(99);
    expect(component.page()).toBe(6);
    tick(300);
  }));
});
