import type { Request } from 'express';

export interface PublicCustomer {
  customerId: string;
  businessId: string;
  slug?: string;
}

export interface RequestWithPublicCustomer extends Request {
  publicCustomer?: PublicCustomer;
}
