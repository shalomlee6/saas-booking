export interface Service {
  _id: string;
  name: string;
  durationMinutes: number;
  price?: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
}
