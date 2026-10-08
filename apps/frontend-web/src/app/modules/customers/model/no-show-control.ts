export type BookingOverride = 'auto' | 'allow' | 'block';
export type BlockReason = 'threshold' | 'manual' | 'allowed' | 'clear';

export interface NoShowControlAppointment {
  id: string;
  start: string;
  serviceName: string;
  excused: boolean;
  excusedAt?: string;
  excusedReason?: string;
}

export interface NoShowControlHistoryEntry {
  at: string;
  action: string;
  reason?: string;
}

export interface NoShowControl {
  noShowCount: number;
  blocked: boolean;
  blockReason: BlockReason;
  bookingOverride: BookingOverride;
  policy: { enabled: boolean; threshold: number };
  noShows: NoShowControlAppointment[];
  history: NoShowControlHistoryEntry[];
}
