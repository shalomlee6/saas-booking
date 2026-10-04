import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  computed,
  inject,
  input,
  output,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  addCalendarDays,
  calendarKeyFromDate,
  createdRangeForPreset,
  dateFromCalendarKey,
} from './calendar-date';
import {
  DATA_PAGE_SIZES,
  type DataBulkAction,
  type DataFilter,
  type DataListLoader,
  type DataListQuery,
  type DataPageSize,
  type DataRowAction,
  type DataTag,
  type EntityDataManagementConfig,
} from './entity-data-management-config';

type ViewState = 'loading' | 'empty' | 'no-results' | 'error' | 'ready';

type DatePresetFilter = Extract<DataFilter, { kind: 'date-preset' }>;

interface PendingRowAction<T> {
  action: DataRowAction<T>;
  row: T;
}

export interface DataHeaderView {
  id: string;
  header: string;
  desktopOnly: boolean;
  end: boolean;
  numeric: boolean;
  sortable: boolean;
  sortState: 'ascending' | 'descending' | 'none';
  sortActive: boolean;
}

export interface DataCellView {
  id: string;
  header: string;
  value: string;
  secondary: string;
  muted: boolean;
  tags: DataTag[] | null;
  avatar: boolean;
  initials: string;
  desktopOnly: boolean;
  end: boolean;
  numeric: boolean;
  smallScreen: boolean;
}

export interface DataCardMeta {
  label: string;
  value: string;
  muted: boolean;
}

export interface DataRowView<T> {
  row: T;
  id: string;
  selected: boolean;
  cells: DataCellView[];
  actions: { action: DataRowAction<T>; shown: boolean }[];
  card: {
    identity: DataCellView | null;
    tags: DataTag[];
    meta: DataCardMeta[];
  };
}

export interface DataSegmentOptionView {
  label: string;
  value: string;
  active: boolean;
}

export interface DataQuickFilterView {
  id: string;
  label: string;
  options: DataSegmentOptionView[];
}

export interface DataDrawerFieldView {
  filter: DataFilter;
  id: string;
  label: string;
  kind: DataFilter['kind'];
  value: string;
  options: DataSegmentOptionView[];
  customRange: Date[] | null;
  showCustomRange: boolean;
}

export interface DataChipView {
  id: string;
  label: string;
  text: string;
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * The filters drawer is portaled to <body>, outside the layout shell that carries the live
 * theme (light/dark, the business accent). These tokens are copied onto the drawer when it
 * opens so its contents render with the same palette as the page behind it.
 */
const DRAWER_TOKENS = [
  '--color-primary',
  '--color-primary-hover',
  '--color-primary-subtle',
  '--color-primary-muted',
  '--color-primary-ink',
  '--bg-app',
  '--bg-card',
  '--border-color',
  '--border-color-strong',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--shadow-xs',
  '--shadow-md',
  '--p-primary-contrast-color',
] as const;
const SKELETON_ROW_COUNT = 8;
const EMPTY_VALUE = '—';

let nextShellId = 0;

@Component({
  selector: 'app-data-management-table',
  standalone: true,
  imports: [TranslatePipe, FormsModule, DrawerModule, TooltipModule, DatePickerModule],
  templateUrl: './data-management-table.component.html',
  styleUrl: './data-management-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'columnsOpen.set(false)',
  },
})
export class DataManagementTableComponent<T> implements OnInit {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly language = inject(LanguageService);

  readonly config = input.required<EntityDataManagementConfig<T>>();
  readonly load = input.required<DataListLoader<T>>();
  readonly reloadNonce = input(0);

  readonly exportRequested = output<DataListQuery>();

  readonly uid = `dm-${nextShellId++}`;
  readonly pageSizes: number[] = [...DATA_PAGE_SIZES];
  readonly skeletonRows = Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => index);
  readonly searchDraft = signal('');
  readonly searchCommitted = signal('');
  readonly page = signal(1);
  readonly limit = signal<DataPageSize>(25);
  readonly sortField = signal<string | null>(null);
  readonly sortOrder = signal<'asc' | 'desc'>('asc');
  readonly filterValues = signal<Record<string, string>>({});
  readonly hiddenOverride = signal<readonly string[] | null>(null);
  readonly selectedIds = signal<readonly string[]>([]);
  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly loadedOnce = signal(false);
  readonly loadError = signal(false);
  readonly pendingBulk = signal<DataBulkAction<T> | null>(null);
  readonly pendingRow = signal<PendingRowAction<T> | null>(null);
  readonly drawerOpen = signal(false);
  readonly columnsOpen = signal(false);
  readonly isMobile = signal(false);
  private readonly retryNonce = signal(0);

  readonly isRtl = computed(() => this.language.language() === 'he');
  readonly drawerPosition = computed(() => (this.isRtl() ? 'right' : 'left'));
  private readonly drawerTokens = signal<Record<string, string>>({});
  readonly drawerStyle = computed(() => ({
    ...this.drawerTokens(),
    ...(this.isMobile() ? {} : { width: 'min(26rem, 100vw)' }),
  }));
  readonly prevIcon = computed(() => (this.isRtl() ? 'pi pi-chevron-right' : 'pi pi-chevron-left'));
  readonly nextIcon = computed(() => (this.isRtl() ? 'pi pi-chevron-left' : 'pi pi-chevron-right'));

  readonly hiddenColumnIds = computed(() => {
    const override = this.hiddenOverride();
    if (override) return override;
    return this.config()
      .columns.filter((column) => column.visibility === 'optional')
      .map((column) => column.id);
  });

  readonly visibleColumns = computed(() => {
    const hidden = new Set(this.hiddenColumnIds());
    return this.config().columns.filter((column) => !hidden.has(column.id));
  });

  readonly quickFilters = computed(() =>
    this.config().filters.filter(
      (filter): filter is Extract<DataFilter, { kind: 'segment' | 'select' }> =>
        filter.placement === 'quick' && (filter.kind === 'segment' || filter.kind === 'select')
    )
  );

  readonly drawerFilters = computed(() =>
    this.config().filters.filter((filter) => (filter.placement ?? 'drawer') === 'drawer')
  );

  readonly activeFilters = computed(() => {
    const values = this.filterValues();
    const defaults = this.config().defaultFilters ?? {};
    return this.config().filters.filter((filter) => {
      const value = (values[filter.id] ?? '').trim();
      const fallback = (defaults[filter.id] ?? '').trim();
      return value.length > 0 && value !== fallback;
    });
  });

  readonly activeFilterCount = computed(() => this.activeFilters().length);

  /** Quick filters show their state in the toolbar itself, so only the rest get a chip. */
  readonly chipFilters = computed(() =>
    this.activeFilters().filter((filter) => (filter.placement ?? 'drawer') === 'drawer')
  );

  readonly drawerActiveCount = computed(() => this.chipFilters().length);

  readonly moreFiltersAria = computed(() => {
    this.language.language();
    const label = this.language.t('dataManagement.moreFilters');
    const count = this.drawerActiveCount();
    return count > 0 ? `${label} (${count})` : label;
  });

  readonly hasActiveQuery = computed(() => {
    if (this.searchCommitted().trim().length > 0) return true;
    const defaults = this.config().defaultFilters ?? {};
    return this.config().filters.some((filter) => {
      const value = (this.filterValues()[filter.id] ?? '').trim();
      const fallback = (defaults[filter.id] ?? '').trim();
      return value !== fallback;
    });
  });

  readonly listQuery = computed<DataListQuery>(() => {
    const filters: Record<string, string> = {};
    for (const filter of this.activeFilters()) {
      this.applyFilter(filter, filters);
    }
    return {
      page: this.page(),
      limit: this.limit(),
      search: this.searchCommitted().trim(),
      sort: this.sortField() ?? this.config().sorts[0]?.field ?? '',
      order: this.sortOrder(),
      filters,
    };
  });

  readonly showSelection = computed(
    () => this.config().permissions.bulk && this.config().bulkActions.length > 0
  );

  readonly showExport = computed(() => this.config().permissions.export);

  readonly selectedRows = computed(() => {
    const ids = new Set(this.selectedIds());
    const rows = this.items() ?? [];
    return rows.filter((row) => ids.has(this.config().rowId(row)));
  });

  readonly viewState = computed<ViewState>(() => {
    if (this.loadError()) return 'error';
    if (this.loading() && this.items().length === 0) return 'loading';
    if (!this.loading() && this.total() === 0 && !this.hasActiveQuery()) return 'empty';
    if (!this.loading() && this.total() === 0 && this.hasActiveQuery()) return 'no-results';
    return 'ready';
  });

  readonly showHeader = computed(() => {
    const config = this.config();
    return !!config.title || !!config.primaryAction || (config.headerActions?.length ?? 0) > 0;
  });

  readonly countText = computed(() => {
    const countLabel = this.config().countLabel;
    if (!countLabel || !this.loadedOnce() || this.loadError()) return '';
    return countLabel(this.total());
  });

  readonly searchPlaceholderText = computed(() => {
    this.language.language();
    return this.config().searchPlaceholder ?? this.language.t('dataManagement.searchPlaceholder');
  });

  readonly headerViews = computed<DataHeaderView[]>(() => {
    const sorts = new Set(this.config().sorts.map((sort) => sort.field));
    const current = this.sortField() ?? this.config().sorts[0]?.field ?? '';
    const order = this.sortOrder();
    return this.visibleColumns().map((column) => {
      const sortable = sorts.has(column.id);
      const sortActive = sortable && current === column.id;
      return {
        id: column.id,
        header: column.header,
        desktopOnly: !column.showOnSmallScreen,
        end: column.align === 'end',
        numeric: !!column.numeric,
        sortable,
        sortActive,
        sortState: sortActive ? (order === 'asc' ? 'ascending' : 'descending') : 'none',
      };
    });
  });

  readonly skeletonColumns = computed(() =>
    this.visibleColumns().map((column) => ({
      id: column.id,
      avatar: !!column.avatar,
      desktopOnly: !column.showOnSmallScreen,
    }))
  );

  readonly rowViews = computed<DataRowView<T>[]>(() => {
    const config = this.config();
    const columns = this.visibleColumns();
    const selected = new Set(this.selectedIds());
    return this.items().map((row) => {
      const id = config.rowId(row);
      const cells = columns.map((column): DataCellView => {
        const value = column.value(row);
        const muted = value === '' || value === EMPTY_VALUE;
        return {
          id: column.id,
          header: column.header,
          value,
          secondary: muted ? '' : (column.secondary?.(row) ?? ''),
          muted,
          tags: column.tags ? [...column.tags(row)] : null,
          avatar: !!column.avatar,
          initials: column.avatar ? this.initials(value) : '',
          desktopOnly: !column.showOnSmallScreen,
          end: column.align === 'end',
          numeric: !!column.numeric,
          smallScreen: column.showOnSmallScreen,
        };
      });
      const cardCells = cells.filter((cell) => cell.smallScreen);
      const plain = cardCells.filter((cell) => !cell.tags);
      return {
        row,
        id,
        selected: selected.has(id),
        cells,
        actions: config.rowActions.flatMap((action) => {
          const shown = !action.visible || action.visible(row);
          if (!shown && !action.keepSlot) return [];
          return [{ action, shown }];
        }),
        card: {
          identity: plain[0] ?? null,
          tags: cardCells.flatMap((cell) => cell.tags ?? []),
          meta: plain.slice(1).map((cell) => ({
            label: cell.header,
            value: cell.secondary ? `${cell.value} · ${cell.secondary}` : cell.value,
            muted: cell.muted,
          })),
        },
      };
    });
  });

  readonly quickFilterViews = computed<DataQuickFilterView[]>(() => {
    const values = this.filterValues();
    return this.quickFilters().map((filter) => ({
      id: filter.id,
      label: filter.label,
      options: filter.options.map((option) => ({
        label: option.label,
        value: option.value,
        active: (values[filter.id] ?? '') === option.value,
      })),
    }));
  });

  readonly drawerFieldViews = computed<DataDrawerFieldView[]>(() => {
    const values = this.filterValues();
    return this.drawerFilters().map((filter) => {
      const value = values[filter.id] ?? '';
      const options = 'options' in filter ? filter.options : [];
      const customRange =
        filter.kind === 'date-preset' && value === 'custom' ? this.customRange(filter) : null;
      return {
        filter,
        id: filter.id,
        label: filter.label,
        kind: filter.kind,
        value,
        options: options.map((option) => ({
          label: option.label,
          value: option.value,
          active: (value || 'all') === option.value,
        })),
        customRange,
        showCustomRange: filter.kind === 'date-preset' && value === 'custom',
      };
    });
  });

  readonly chipViews = computed<DataChipView[]>(() =>
    this.chipFilters().map((filter) => ({
      id: filter.id,
      label: filter.label,
      text: this.chipLabel(filter),
    }))
  );

  readonly columnMenu = computed(() =>
    this.config().columns.map((column) => ({
      id: column.id,
      header: column.header,
      visible: !this.hiddenColumnIds().includes(column.id),
    }))
  );

  readonly allOnPageSelected = computed(
    () => this.items().length > 0 && this.selectedRows().length === this.items().length
  );

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));

  readonly pageRange = computed(() => {
    const total = this.total();
    const from = total === 0 ? 0 : (this.page() - 1) * this.limit() + 1;
    const to = Math.min(total, this.page() * this.limit());
    return { from, to, total };
  });

  /** Page numbers with `gap` where a run of pages is collapsed. */
  readonly pageItems = computed<{ key: string; page: number | null; current: boolean }[]>(() => {
    const count = this.pageCount();
    const current = Math.min(this.page(), count);
    const wanted = new Set([1, count, current - 1, current, current + 1]);
    const pages = [...wanted].filter((value) => value >= 1 && value <= count).sort((a, b) => a - b);
    const out: { key: string; page: number | null; current: boolean }[] = [];
    pages.forEach((value, index) => {
      if (index > 0 && value - pages[index - 1] > 1) {
        out.push({ key: `gap-${value}`, page: null, current: false });
      }
      out.push({ key: `page-${value}`, page: value, current: value === current });
    });
    return out;
  });

  readonly skeletonCards = this.skeletonRows.slice(0, 4);

  readonly canGoPrev = computed(() => this.page() > 1);
  readonly canGoNext = computed(() => this.page() < this.pageCount());

  private readonly request = computed(() => ({
    query: this.listQuery(),
    load: this.load(),
    retryNonce: this.retryNonce(),
    reloadNonce: this.reloadNonce(),
  }));

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const query = window.matchMedia('(max-width: 40rem)');
      this.isMobile.set(query.matches);
      const listener = (event: MediaQueryListEvent) => this.isMobile.set(event.matches);
      query.addEventListener('change', listener);
      this.destroyRef.onDestroy(() => query.removeEventListener('change', listener));
    }
  }

  ngOnInit(): void {
    const defaults = this.config().defaultFilters ?? {};
    if (Object.keys(defaults).length > 0) {
      this.filterValues.set({ ...defaults });
    }
    runInInjectionContext(this.injector, () => {
      toObservable(this.searchDraft)
        .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
        .subscribe((value) => {
          if (value.trim() === this.searchCommitted()) return;
          this.searchCommitted.set(value.trim());
          this.page.set(1);
          this.selectedIds.set([]);
        });

      toObservable(this.request)
        .pipe(
          switchMap(({ query, load }) => {
            this.loading.set(true);
            this.loadError.set(false);
            return load(query).pipe(
              map((page) => ({ ok: true as const, page })),
              catchError(() => of({ ok: false as const }))
            );
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((result) => {
          this.loading.set(false);
          if (!result.ok) {
            this.loadError.set(true);
            this.items.set([]);
            this.total.set(0);
            return;
          }
          this.loadedOnce.set(true);
          this.items.set(result.page.items ?? []);
          this.total.set(result.page.total ?? 0);
        });
    });
  }

  openDrawer(): void {
    if (typeof getComputedStyle === 'function') {
      const computed = getComputedStyle(this.host.nativeElement);
      const tokens: Record<string, string> = {};
      for (const name of DRAWER_TOKENS) {
        const value = computed.getPropertyValue(name).trim();
        if (value) tokens[name] = value;
      }
      this.drawerTokens.set(tokens);
    }
    this.drawerOpen.set(true);
  }

  onDocumentClick(event: Event): void {
    if (!this.columnsOpen()) return;
    const target = event.target;
    if (target instanceof Element && target.closest(`[data-columns-wrap="${this.uid}"]`)) return;
    this.columnsOpen.set(false);
  }

  onSearchInput(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchDraft.set('');
    if (this.searchCommitted() !== '') {
      this.searchCommitted.set('');
      this.page.set(1);
      this.selectedIds.set([]);
    }
  }

  setFilter(id: string, value: string): void {
    this.setMany({ [id]: value ?? '' });
  }

  setMany(values: Record<string, string>): void {
    const current = this.filterValues();
    const changed = Object.entries(values).some(([key, value]) => (current[key] ?? '') !== value);
    if (!changed) return;
    this.filterValues.update((existing) => ({ ...existing, ...values }));
    this.page.set(1);
    this.selectedIds.set([]);
  }

  clearFilter(id: string): void {
    this.resetFilters([id]);
  }

  clearDrawerFilters(): void {
    this.resetFilters(this.chipFilters().map((filter) => filter.id));
  }

  clearAllFilters(): void {
    this.searchDraft.set('');
    this.searchCommitted.set('');
    this.filterValues.set({ ...(this.config().defaultFilters ?? {}) });
    this.page.set(1);
    this.selectedIds.set([]);
  }

  onCustomRange(filter: DatePresetFilter, value: Date[] | null): void {
    if (!value?.[0] || !value[1]) return;
    const from = calendarKeyFromDate(value[0]);
    const to = addCalendarDays(calendarKeyFromDate(value[1]), 1);
    this.setMany({
      [filter.id]: 'custom',
      [filter.fromId]: from,
      [filter.toId]: to,
    });
  }

  customRange(filter: DatePresetFilter): Date[] | null {
    const from = this.filterValue(filter.fromId);
    const to = this.filterValue(filter.toId);
    if (!from || !to) return null;
    return [dateFromCalendarKey(from), dateFromCalendarKey(addCalendarDays(to, -1))];
  }

  chipLabel(filter: DataFilter): string {
    const value = this.filterValue(filter.id);
    if (!('options' in filter)) return `${filter.label}: ${value}`;
    const option = filter.options.find((item) => item.value === value);
    return option ? `${filter.label}: ${option.label}` : filter.label;
  }

  private initials(value: string): string {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = Array.from(parts[0])[0] ?? '';
    const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? '') : '';
    return (first + last).toUpperCase();
  }

  toggleSort(field: string): void {
    if (!this.config().sorts.some((sort) => sort.field === field)) return;
    const current = this.sortField() ?? this.config().sorts[0]?.field ?? '';
    if (current === field) {
      this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortOrder.set('asc');
    }
    this.sortField.set(field);
    this.page.set(1);
    this.selectedIds.set([]);
  }

  setPage(page: number): void {
    const next = Math.min(this.pageCount(), Math.max(1, page));
    if (next === this.page()) return;
    this.page.set(next);
    this.selectedIds.set([]);
  }

  setLimit(limit: DataPageSize): void {
    if (limit === this.limit()) return;
    this.limit.set(limit);
    this.page.set(1);
    this.selectedIds.set([]);
  }

  onLimitChange(value: string | number): void {
    const next = Number(value);
    this.setLimit(next === 50 || next === 100 ? next : 25);
  }

  toggleColumn(id: string): void {
    const hidden = new Set(this.hiddenColumnIds());
    if (hidden.has(id)) {
      hidden.delete(id);
    } else if (this.config().columns.length - hidden.size > 1) {
      hidden.add(id);
    }
    this.hiddenOverride.set([...hidden]);
  }

  toggleColumns(): void {
    this.columnsOpen.update((open) => !open);
  }

  toggleRow(row: T): void {
    const id = this.config().rowId(row);
    const current = this.selectedIds();
    this.selectedIds.set(
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  togglePageSelection(): void {
    const pageIds = this.items().map((row) => this.config().rowId(row));
    const selected = new Set(this.selectedIds());
    const allOnPage = pageIds.every((id) => selected.has(id));
    if (allOnPage) {
      this.selectedIds.set(this.selectedIds().filter((id) => !pageIds.includes(id)));
      return;
    }
    this.selectedIds.set([...new Set([...this.selectedIds(), ...pageIds])]);
  }

  requestBulk(action: DataBulkAction<T>): void {
    if (!this.showSelection() || this.selectedRows().length === 0) return;
    this.pendingBulk.set(action);
  }

  dismissBulk(): void {
    this.pendingBulk.set(null);
  }

  confirmBulk(): void {
    const action = this.pendingBulk();
    const rows = this.selectedRows();
    if (!action || rows.length === 0) return;
    action.run(rows);
    this.pendingBulk.set(null);
    this.selectedIds.set([]);
  }

  rowConfirmText(action: DataRowAction<T>, row: T): string {
    const text = action.confirmText;
    return typeof text === 'function' ? text(row) : (text ?? '');
  }

  requestRow(event: Event, action: DataRowAction<T>, row: T): void {
    event.stopPropagation();
    if (action.confirmText) {
      this.pendingRow.set({ action, row });
      return;
    }
    action.run(row);
  }

  dismissRow(): void {
    this.pendingRow.set(null);
  }

  confirmRow(): void {
    const pending = this.pendingRow();
    if (!pending) return;
    pending.action.run(pending.row);
    this.pendingRow.set(null);
  }

  onRowClick(event: Event, row: T): void {
    const handler = this.config().onRowClick;
    if (!handler) return;
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, label, select, .data-table-actions')) {
      return;
    }
    handler(row);
  }

  requestExport(): void {
    if (!this.showExport()) return;
    this.exportRequested.emit(this.listQuery());
  }

  retry(): void {
    this.retryNonce.update((value) => value + 1);
  }

  private filterValue(id: string): string {
    return this.filterValues()[id] ?? '';
  }

  private resetFilters(ids: readonly string[]): void {
    const defaults = this.config().defaultFilters ?? {};
    this.filterValues.update((current) => {
      const next = { ...current };
      for (const id of ids) {
        const filter = this.config().filters.find((item) => item.id === id);
        if (defaults[id] !== undefined) next[id] = defaults[id];
        else delete next[id];
        if (filter?.kind === 'date-preset') {
          delete next[filter.fromId];
          delete next[filter.toId];
        }
      }
      return next;
    });
    this.page.set(1);
    this.selectedIds.set([]);
  }

  private applyFilter(filter: DataFilter, filters: Record<string, string>): void {
    const value = (this.filterValues()[filter.id] ?? '').trim();
    if (!value) return;
    if (filter.kind === 'preset') {
      const option = filter.options.find((item) => item.value === value);
      if (!option) return;
      for (const [key, param] of Object.entries(option.params)) {
        if (param !== '') filters[key] = param;
      }
      return;
    }
    if (filter.kind === 'date-preset') {
      if (value === 'custom') {
        const from = (this.filterValues()[filter.fromId] ?? '').trim();
        const to = (this.filterValues()[filter.toId] ?? '').trim();
        if (from) filters[filter.fromId] = from;
        if (to) filters[filter.toId] = to;
        return;
      }
      const range = createdRangeForPreset(value);
      if (!range) return;
      filters[filter.fromId] = range.from;
      filters[filter.toId] = range.to;
      return;
    }
    filters[filter.id] = value;
  }
}
