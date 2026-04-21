export interface Customer {
  _id: string;
  name: string;
  /** Alias of `name` from GET /api/customers for display (e.g. autocomplete). */
  fullName?: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
