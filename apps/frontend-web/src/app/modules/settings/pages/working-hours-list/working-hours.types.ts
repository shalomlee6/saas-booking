export interface OpeningHoursRange {
  start: string;
  end: string;
}

export interface OpeningHoursDay {
  day: number;
  isOpen: boolean;
  ranges: OpeningHoursRange[];
}

export interface OpeningHours {
  slotStepMinutes: number;
  days: OpeningHoursDay[];
}

export type OverrideType = 'closed' | 'custom';

export interface Override {
  id: string;
  date: string;
  type: OverrideType;
  ranges: OpeningHoursRange[];
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  slotStepMinutes: 30,
  days: [
    { day: 0, isOpen: true, ranges: [{ start: '08:00', end: '18:00' }] },
    { day: 1, isOpen: true, ranges: [{ start: '08:00', end: '18:00' }] },
    { day: 2, isOpen: true, ranges: [{ start: '08:00', end: '18:00' }] },
    { day: 3, isOpen: true, ranges: [{ start: '08:00', end: '18:00' }] },
    { day: 4, isOpen: true, ranges: [{ start: '08:00', end: '18:00' }] },
    { day: 5, isOpen: true, ranges: [{ start: '08:00', end: '14:00' }] },
    { day: 6, isOpen: false, ranges: [] },
  ],
};

export const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
