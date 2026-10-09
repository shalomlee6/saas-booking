import type { Request } from 'express';

export interface PublicCustomer {
  sessionId: string;
  customerId?: string;
  businessId: string;
  slug?: string;
  phone: string;
  verified: boolean;
}

export interface RequestWithPublicCustomer extends Request {
  publicCustomer?: PublicCustomer;
}
