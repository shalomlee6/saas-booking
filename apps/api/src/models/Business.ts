import { Schema, model, Types, Document } from 'mongoose';
import { BUSINESS_SETTINGS_DEFAULTS as D } from '../config/businessSettingsDefaults';

export interface IBusinessUi {
  themeMode: 'light' | 'dark';
  primaryColor: string;
  sidebarColor: string;
  backgroundColor?: string;
  logoUrl?: string;
  dashboardLayout?: 'classic' | 'compact';
}

export type BusinessPlan = 'free' | 'pro' | 'premium';

export interface IBusiness extends Document {
  ownerId: Types.ObjectId;
  name: string;
  phone?: string;
  address?: string;
  slug: string;
  /** Canonical subscription tier (also mirrored in BusinessSettings.plan for legacy paths). */
  plan: BusinessPlan;
  ui?: IBusinessUi;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessUiSchema = new Schema<IBusinessUi>(
  {
    themeMode: { type: String, enum: ['light', 'dark'], default: D.ui.themeMode },
    primaryColor: { type: String, default: D.ui.primaryColor },
    sidebarColor: { type: String, default: D.ui.sidebarColor },
    backgroundColor: { type: String, default: D.ui.backgroundColor },
    logoUrl: { type: String, default: D.ui.logoUrl },
    dashboardLayout: { type: String, enum: ['classic', 'compact'], default: D.ui.dashboardLayout },
  },
  { _id: false }
);

const BusinessSchema = new Schema<IBusiness>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    phone: String,
    address: String,
    slug: { type: String, required: true, unique: true },
    plan: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      default: 'free',
      index: true,
    },
    ui: { type: BusinessUiSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const Business = model<IBusiness>('Business', BusinessSchema);
