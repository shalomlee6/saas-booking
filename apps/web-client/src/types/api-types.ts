export interface User {
  id: string;
  email: string;
  role: string;
  businessId?: string;
}

export interface Business {
  _id: string;
  name: string;
  slug: string;
  phone?: string;
  address?: string;
}

export interface Customer {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}
