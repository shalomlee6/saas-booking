/** Per-customer, per-service override (duration/price/notes). Mirrors CustomerServiceConfig on the API. */
export interface CustomerServiceConfig {
  _id: string;
  businessId: string;
  customerId: string;
  serviceId: string;
  durationOverrideMinutes?: number;
  priceOverride?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerServiceConfigDto {
  customerId: string;
  serviceId: string;
  durationOverrideMinutes?: number;
  priceOverride?: number;
  notes?: string;
}

export interface UpdateCustomerServiceConfigDto {
  /** null explicitly clears the override, reverting to the service's own default. */
  durationOverrideMinutes?: number | null;
  priceOverride?: number | null;
  notes?: string;
}
