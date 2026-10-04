import type { Observable } from 'rxjs';

/** Page sizes shared with the list-query contract. */
export const DATA_PAGE_SIZES = [25, 50, 100] as const;
export type DataPageSize = (typeof DATA_PAGE_SIZES)[number];

export interface DataListQuery {
  page: number;
  limit: DataPageSize;
  search: string;
  sort: string;
  order: 'asc' | 'desc';
  /** Flat filter values. Empty values are omitted. */
  filters: Record<string, string>;
}

export interface DataListPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type DataListLoader<T> = (query: DataListQuery) => Observable<DataListPage<T>>;

export type DataTagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';

export interface DataTag {
  label: string;
  severity: DataTagSeverity;
}

export interface DataColumn<T> {
  id: string;
  header: string;
  /** `default` starts visible. `optional` starts hidden and is offered in the column selector. */
  visibility: 'default' | 'optional';
  /** When false, the column is hidden below the small-screen breakpoint. */
  showOnSmallScreen: boolean;
  value: (row: T) => string;
  /** Renders status chips instead of the plain `value` string. */
  tags?: (row: T) => DataTag[];
  /** End-align numeric and currency columns. */
  align?: 'start' | 'end';
  /** Tabular figures for counts and money. */
  numeric?: boolean;
  /** Muted second line under the value, such as a phone under a name or "12 days ago" under a date. */
  secondary?: (row: T) => string;
  /** Identity cell: shows an initials avatar (from `value`) before the value. */
  avatar?: boolean;
}

export interface DataFilterOption {
  label: string;
  value: string;
}

/** A preset choice expands to existing API params. The preset id itself is not sent. */
export interface DataPresetOption extends DataFilterOption {
  params: Readonly<Record<string, string>>;
}

export type DataFilterPlacement = 'quick' | 'drawer';

interface DataFilterBase {
  id: string;
  label: string;
  /** Quick filters stay on the toolbar. Everything else opens in the drawer. */
  placement?: DataFilterPlacement;
}

export type DataFilter =
  | (DataFilterBase & { kind: 'text' })
  | (DataFilterBase & { kind: 'select' | 'segment'; options: DataFilterOption[] })
  | (DataFilterBase & { kind: 'preset'; options: DataPresetOption[] })
  | (DataFilterBase & {
      kind: 'date-preset';
      fromId: string;
      toId: string;
      options: DataFilterOption[];
    });

export interface DataSort {
  field: string;
  label: string;
}

export type DataActionSeverity =
  | 'success'
  | 'info'
  | 'warn'
  | 'danger'
  | 'help'
  | 'primary'
  | 'secondary'
  | 'contrast';

export interface DataRowAction<T> {
  id: string;
  label: string;
  icon?: string;
  severity?: DataActionSeverity;
  /** Keep an empty slot when the action is hidden so the other buttons stay aligned. */
  keepSlot?: boolean;
  /** When set, the shell asks for confirmation before `run`. A function can use the row. */
  confirmText?: string | ((row: T) => string);
  /** When omitted, the action is shown for every row. */
  visible?: (row: T) => boolean;
  run: (row: T) => void;
}

export interface DataBulkAction<T> {
  id: string;
  label: string;
  /** Shown in the confirmation dialog before the action runs. */
  consequence: string;
  run: (rows: T[]) => void;
}

export interface DataPrimaryAction {
  label: string;
  /** PrimeIcons class. Defaults to a plus. */
  icon?: string;
  run: () => void;
}

/** Secondary header button, rendered icon-only with a tooltip. */
export interface DataHeaderAction {
  id: string;
  label: string;
  icon: string;
  run: () => void;
}

/** Copy and icon for the shell's empty state. Falls back to generic strings. */
export interface DataEmptyState {
  icon?: string;
  title: string;
  hint?: string;
  /** Defaults to the primary action's label. */
  actionLabel?: string;
}

/**
 * Metrics, bulk actions, and export are owner-only in V1.
 * The shell hides bulk and export when the flag is false.
 * `metrics` is for the entity screen; the shell does not render a metrics panel.
 */
export interface DataManagementPermissions {
  metrics: boolean;
  bulk: boolean;
  export: boolean;
}

export interface EntityDataManagementConfig<T> {
  /** Page heading. When set, the shell renders the header row (title, count, actions). */
  title?: string;
  /** Muted subtitle under the title, built from the filtered total, such as "142 customers". */
  countLabel?: (total: number) => string;
  /** Icon-only secondary buttons next to the primary action. */
  headerActions?: readonly DataHeaderAction[];
  empty?: DataEmptyState;
  rowId: (row: T) => string;
  columns: readonly DataColumn<T>[];
  /** Fields the entity's search covers. The shell sends the raw search string. */
  searchFields: readonly string[];
  /** Shown as the search field placeholder. The accessible name stays "Search". */
  searchPlaceholder?: string;
  filters: readonly DataFilter[];
  sorts: readonly DataSort[];
  rowActions: readonly DataRowAction<T>[];
  bulkActions: readonly DataBulkAction<T>[];
  /** Header primary button, such as "New customer". */
  primaryAction?: DataPrimaryAction;
  /** Row and card click. Clicks on buttons and inputs do not call this. */
  onRowClick?: (row: T) => void;
  permissions: DataManagementPermissions;
  /** Applied on first load and when filters are cleared. */
  defaultFilters?: Readonly<Record<string, string>>;
}
