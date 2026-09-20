export type TimeOfDayBucket = 'morning' | 'afternoon' | 'evening' | 'night';

export interface CustomerPreferences {
  /** Manually set by the owner. Not currently editable in the UI — no staff-picker exists yet. */
  preferredStaffId?: string;
  preferredTimeOfDay?: TimeOfDayBucket;
  allergies?: string;
  tags?: string[];
}

export interface Customer {
  _id: string;
  name: string;
  /** Alias of `name` from GET /api/customers for display (e.g. autocomplete). */
  fullName?: string;
  phone: string;
  email?: string;
  notes?: string;
  preferences?: CustomerPreferences;
  createdAt: string;
  updatedAt: string;
}
