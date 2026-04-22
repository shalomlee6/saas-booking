import { Schema, model, Types, Document } from 'mongoose';
import type { SettingsPlan } from '../dto/enums';

/** Day of week 0 = Sunday, 6 = Saturday */
export interface IOpeningHoursRange {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

export interface IOpeningHoursDay {
  day: number;   // 0-6
  isOpen: boolean;
  ranges: IOpeningHoursRange[];
}

export interface IOpeningHours {
  slotStepMinutes: number;
  days: IOpeningHoursDay[];
}

export interface ILandingProduct {
  name: string;
  description?: string;
  price: number;
}

export interface IBusinessSettings extends Document {
  businessId: Types.ObjectId;
  plan: SettingsPlan;
  theme: {
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    logoUrl: string | null;
    fontFamily: string;
  };
  features: {
    bookingEnabled: boolean;
    paymentsEnabled: boolean;
    marketingModule: boolean;
    chatModule: boolean;
    waitlistEnabled: boolean;
    analyticsEnabled: boolean;
    customDomainEnabled: boolean;
  };
  /** Shown on the public booking page when supported by the client. */
  bookingWelcomeMessage?: string;
  /** Hero / SEO tagline on public landing (Hebrew). */
  landingTagline?: string;
  /** Full-bleed hero background image URL (optional). */
  coverImageUrl?: string;
  /** Gallery images for public landing portfolio section. */
  portfolioImages?: string[];
  /** Featured products / treatments on public landing. */
  landingProducts?: ILandingProduct[];
  /** Display rating when there are no computed reviews yet (1–5). */
  publicRating?: number;
  /** Public contact phone shown on landing / booking CTA (optional). */
  businessPhonePublic?: string;
  localization: {
    language: 'he' | 'en';
    timezone: string;
    currency: string;
  };
  openingHours?: IOpeningHours;
  createdAt: Date;
  updatedAt: Date;
}

/** Default: Sun–Thu 08:00–18:00, Fri 08:00–14:00, Sat closed */
export const defaultOpeningHours: IOpeningHours = {
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

const BusinessSettingsSchema = new Schema<IBusinessSettings>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['free', 'normal', 'pro', 'premium'],
      default: 'free',
    },
    theme: {
      colors: {
        primary: { type: String, default: '#F35271' },
        secondary: { type: String, default: '#FF9DBC' },
        accent: { type: String, default: '#6CD6CD' },
        background: { type: String, default: '#FFFFFF' },
        text: { type: String, default: '#111827' },
      },
      logoUrl: { type: String, default: null },
      fontFamily: { type: String, default: 'system-ui' },
    },
    features: {
      bookingEnabled: { type: Boolean, default: true },
      paymentsEnabled: { type: Boolean, default: false },
      marketingModule: { type: Boolean, default: false },
      chatModule: { type: Boolean, default: false },
      waitlistEnabled: { type: Boolean, default: false },
      analyticsEnabled: { type: Boolean, default: false },
      customDomainEnabled: { type: Boolean, default: false },
    },
    bookingWelcomeMessage: { type: String, default: '' },
    landingTagline: { type: String, default: '' },
    coverImageUrl: { type: String, default: '' },
    portfolioImages: { type: [String], default: [] },
    landingProducts: {
      type: [
        {
          name: { type: String, required: true },
          description: { type: String },
          price: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
    publicRating: { type: Number, min: 1, max: 5, default: 5 },
    businessPhonePublic: { type: String, default: '' },
    localization: {
      language: { type: String, enum: ['he', 'en'], default: 'he' },
      timezone: { type: String, default: 'Asia/Jerusalem' },
      currency: { type: String, default: 'ILS' },
    },
    openingHours: {
      slotStepMinutes: { type: Number, default: 30 },
      days: [
        {
          day: Number,
          isOpen: Boolean,
          ranges: [{ start: String, end: String }],
        },
      ],
    },
  },
  { timestamps: true }
);

BusinessSettingsSchema.pre('save', function (next) {
  if (!this.openingHours || !this.openingHours.days || this.openingHours.days.length === 0) {
    this.openingHours = defaultOpeningHours;
  }
  if (!this.localization) {
    this.localization = {
      language: 'he',
      timezone: 'Asia/Jerusalem',
      currency: 'ILS',
    };
  } else if (!this.localization.timezone) {
    this.localization.timezone = 'Asia/Jerusalem';
  }
  next();
});

export const BusinessSettings = model<IBusinessSettings>('BusinessSettings', BusinessSettingsSchema);

