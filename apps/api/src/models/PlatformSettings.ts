import { Schema, model, Document } from 'mongoose';

export interface IPlatformSettings extends Document {
  /** Default trial length when provisioning tenants (days). */
  defaultTrialDurationDays: number;
  maintenanceMode: boolean;
  /** Arbitrary feature toggles for the platform. */
  featureFlags: Record<string, boolean>;
  platformDisplayName: string;
  /** Read-only hint for admins; real SMTP lives in server env. */
  emailConfigurationNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    defaultTrialDurationDays: { type: Number, default: 14, min: 0, max: 3650 },
    maintenanceMode: { type: Boolean, default: false },
    featureFlags: { type: Schema.Types.Mixed, default: {} },
    platformDisplayName: { type: String, default: 'SaaS Booking', trim: true },
    emailConfigurationNote: {
      type: String,
      default: 'Outbound email is configured via server environment variables (not editable here).',
      trim: true,
    },
  },
  { timestamps: true }
);

export const PlatformSettings = model<IPlatformSettings>(
  'PlatformSettings',
  PlatformSettingsSchema
);
