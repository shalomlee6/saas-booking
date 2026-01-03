import { Schema, model, Types, Document } from 'mongoose';

export type Plan = 'free' | 'normal' | 'premium';

export interface IBusinessSettings extends Document {
  businessId: Types.ObjectId;
  plan: Plan;
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
  };
  localization: {
    language: 'he' | 'en';
    timezone: string;
    currency: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

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
      enum: ['free', 'normal', 'premium'],
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
    },
    localization: {
      language: { type: String, enum: ['he', 'en'], default: 'he' },
      timezone: { type: String, default: 'Asia/Jerusalem' },
      currency: { type: String, default: 'ILS' },
    },
  },
  { timestamps: true }
);

export const BusinessSettings = model<IBusinessSettings>('BusinessSettings', BusinessSettingsSchema);

