export interface CreateServiceDto {
  name: string;
  durationMinutes: number;
  price?: number;
  description?: string;
  isActive?: boolean;
}
