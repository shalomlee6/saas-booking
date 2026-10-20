import { Schema, model, Types, Document } from 'mongoose';
import type { SettingsPlan } from '../dto/enums';
import { BUSINESS_SETTINGS_DEFAULTS as D } from '../config/businessSettingsDefaults';

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

export interface ILandingGalleryItem {
  id: string;
  imageUrl: string;
  title?: string;
  type: 'product' | 'service';
}

export interface ILandingContact {
  whatsapp?: string;
  email?: string;
  location?: string;
}

export interface ILandingSectionVisibility {
  hero?: boolean;
  services?: boolean;
  gallery?: boolean;
  products?: boolean;
  reviews?: boolean;
  cta?: boolean;
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
    /** Public tenant site theme preset id (see frontend `theme-presets.ts` registry). */
    preset?: string;
    /** Default light/dark mode for the public site; a customer's own explicit
     *  choice (stored client-side) always takes priority over this. */
    defaultMode?: 'light' | 'dark';
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
  /** Online-booking block. Missing on older documents — treated as enabled with threshold 3. */
  noShowPolicy?: {
    enabled: boolean;
    threshold: number;
  };
  /** Public identify birthday field. Missing on older documents — treated as required. */
  birthdayField?: 'required' | 'optional' | 'hidden';
  /** Hours before the visit that a client may still cancel or reschedule. Missing → 24. */
  cancellationWindowHours?: number;
  /** Online booking rules. Missing fields use the product defaults. */
  onlineBooking?: {
    enabled?: boolean;
    minLeadMinutes?: number;
    maxAdvanceDays?: number;
    bufferMinutes?: number;
    onlineDefaultStatus?: 'confirmed' | 'pending';
    maxActiveAppointmentsPerClient?: number | null;
    clientCanCancelOnline?: boolean;
  };
  /** Extra reliability counters. No-show itself stays on `noShowPolicy`. */
  reliability?: {
    lateCancellation?: { enabled?: boolean; threshold?: number };
    lateArrival?: { enabled?: boolean; threshold?: number };
    lookback?: '12months' | 'all';
  };
  /** Public contact phone shown on landing / booking CTA (optional). */
  businessPhonePublic?: string;
  /** Secondary hero / feature image URL for public landing. */
  landingSecondaryHeroImageUrl?: string;
  /** Longer hero body copy on public landing. */
  landingHeroDescription?: string;
  /** Structured gallery items (image, title, type) for public landing. */
  landingGalleryItems?: ILandingGalleryItem[];
  /** Extended contact block (whatsapp, email, location) for public landing. */
  landingContact?: ILandingContact;
  /** Service IDs in display order on public landing. */
  landingServiceOrder?: string[];
  /** Toggle visibility of landing sections. */
  landingSectionVisibility?: ILandingSectionVisibility;
  localization: {
    language: 'he' | 'en';
    timezone: string;
    currency: string;
  };
  openingHours?: IOpeningHours;
  /**
   * Bookkeeping for "restore previous settings" after a reset. Not a setting: never reset, never shown.
   * `fingerprint` is the hash of the reset scope's values right after the reset; once any of them
   * changes, the snapshot is no longer offered.
   */
  resetUndo?: { auditId: string; scope: string; fingerprint: string; at: Date };
  createdAt: Date;
  updatedAt: Date;
}

/** Default opening hours (see BUSINESS_SETTINGS_DEFAULTS). */
export const defaultOpeningHours: IOpeningHours = D.openingHours;

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
      default: D.plan,
    },
    theme: {
      colors: {
        primary: { type: String, default: D.theme.colors.primary },
        secondary: { type: String, default: D.theme.colors.secondary },
        accent: { type: String, default: D.theme.colors.accent },
        background: { type: String, default: D.theme.colors.background },
        text: { type: String, default: D.theme.colors.text },
      },
      preset: { type: String, default: D.theme.preset },
      defaultMode: { type: String, enum: ['light', 'dark'], default: D.theme.defaultMode },
      logoUrl: { type: String, default: D.theme.logoUrl },
      fontFamily: { type: String, default: D.theme.fontFamily },
    },
    features: {
      bookingEnabled: { type: Boolean, default: D.features.bookingEnabled },
      paymentsEnabled: { type: Boolean, default: D.features.paymentsEnabled },
      marketingModule: { type: Boolean, default: D.features.marketingModule },
      chatModule: { type: Boolean, default: D.features.chatModule },
      waitlistEnabled: { type: Boolean, default: D.features.waitlistEnabled },
      analyticsEnabled: { type: Boolean, default: D.features.analyticsEnabled },
      customDomainEnabled: { type: Boolean, default: D.features.customDomainEnabled },
    },
    bookingWelcomeMessage: { type: String, default: D.landing.bookingWelcomeMessage },
    landingTagline: { type: String, default: D.landing.tagline },
    coverImageUrl: { type: String, default: D.landing.coverImageUrl },
    landingSecondaryHeroImageUrl: { type: String, default: D.landing.secondaryHeroImageUrl },
    landingHeroDescription: { type: String, default: D.landing.heroDescription },
    landingGalleryItems: {
      type: [
        {
          id: { type: String, required: true },
          imageUrl: { type: String, required: true },
          title: { type: String, default: '' },
          type: { type: String, enum: ['product', 'service'], default: 'service' },
        },
      ],
      default: [],
    },
    landingContact: {
      whatsapp: { type: String, default: D.landing.contact.whatsapp },
      email: { type: String, default: D.landing.contact.email },
      location: { type: String, default: D.landing.contact.location },
    },
    landingServiceOrder: { type: [String], default: [] },
    landingSectionVisibility: {
      hero: { type: Boolean },
      services: { type: Boolean },
      gallery: { type: Boolean },
      products: { type: Boolean },
      reviews: { type: Boolean },
      cta: { type: Boolean },
    },
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
    publicRating: { type: Number, min: 1, max: 5, default: D.landing.publicRating },
    noShowPolicy: {
      enabled: { type: Boolean, default: D.noShowPolicy.enabled },
      threshold: { type: Number, default: D.noShowPolicy.threshold, min: 1, max: 20 },
    },
    birthdayField: { type: String, enum: ['required', 'optional', 'hidden'], default: D.birthdayField },
    cancellationWindowHours: { type: Number, default: D.cancellationWindowHours, min: 0, max: 24 * 30 },
    onlineBooking: {
      enabled: { type: Boolean, default: D.onlineBooking.enabled },
      minLeadMinutes: { type: Number, default: D.onlineBooking.minLeadMinutes },
      maxAdvanceDays: { type: Number, default: D.onlineBooking.maxAdvanceDays, min: 7, max: 365 },
      bufferMinutes: { type: Number, default: D.onlineBooking.bufferMinutes },
      onlineDefaultStatus: {
        type: String,
        enum: ['confirmed', 'pending'],
        default: D.onlineBooking.onlineDefaultStatus,
      },
      maxActiveAppointmentsPerClient: { type: Number, default: D.onlineBooking.maxActiveAppointmentsPerClient },
      clientCanCancelOnline: { type: Boolean, default: D.onlineBooking.clientCanCancelOnline },
    },
    reliability: {
      lateCancellation: {
        enabled: { type: Boolean, default: D.reliability.lateCancellation.enabled },
        threshold: { type: Number, default: D.reliability.lateCancellation.threshold, min: 1, max: 20 },
      },
      lateArrival: {
        enabled: { type: Boolean, default: D.reliability.lateArrival.enabled },
        threshold: { type: Number, default: D.reliability.lateArrival.threshold, min: 1, max: 20 },
      },
      lookback: { type: String, enum: ['12months', 'all'], default: D.reliability.lookback },
    },
    businessPhonePublic: { type: String, default: D.landing.businessPhonePublic },
    localization: {
      language: { type: String, enum: ['he', 'en'], default: D.localization.language },
      timezone: { type: String, default: D.localization.timezone },
      currency: { type: String, default: D.localization.currency },
    },
    openingHours: {
      slotStepMinutes: { type: Number, default: D.openingHours.slotStepMinutes },
      days: [
        {
          day: Number,
          isOpen: Boolean,
          ranges: [{ start: String, end: String }],
        },
      ],
    },
    resetUndo: {
      auditId: String,
      scope: String,
      fingerprint: String,
      at: Date,
    },
  },
  { timestamps: true }
);

BusinessSettingsSchema.pre('save', function (next) {
  if (!this.openingHours || !this.openingHours.days || this.openingHours.days.length === 0) {
    this.openingHours = defaultOpeningHours;
  }
  if (!this.localization) {
    this.localization = { ...D.localization };
  } else if (!this.localization.timezone) {
    this.localization.timezone = D.localization.timezone;
  }
  next();
});

export const BusinessSettings = model<IBusinessSettings>('BusinessSettings', BusinessSettingsSchema);

