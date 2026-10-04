export interface CustomerListRow {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  isActive: boolean;
  blocked?: boolean;
  createdAt: string;
  totalVisits?: number;
  totalRevenue?: number;
  averageVisitValue?: number;
  lastVisit?: string | null;
  nextAppointment?: string | null;
  noShowCount?: number;
  customerType?: 'new' | 'returning';
  preferredServiceId?: string | null;
  preferredServiceName?: string;
  preferredTimeOfDay?: string | null;
}

/** Must stay a subset of the API `CUSTOMER_LIST_SORT_FIELDS` allowlist. */
export const CUSTOMER_LIST_SORT_FIELDS = [
  'name',
  'phone',
  'createdAt',
  'totalVisits',
  'totalRevenue',
  'averageVisitValue',
  'lastVisit',
  'nextAppointment',
  'noShowCount',
] as const;
