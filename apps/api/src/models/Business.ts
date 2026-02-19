import { Schema, model, Types, Document } from 'mongoose';

export interface IBusinessUi {
  themeMode: 'light' | 'dark';
  primaryColor: string;
  sidebarColor: string;
  backgroundColor?: string;
  logoUrl?: string;
  dashboardLayout?: 'classic' | 'compact';
}

export interface IBusiness extends Document {
  ownerId: Types.ObjectId;
  name: string;
  phone?: string;
  address?: string;
  slug: string;
  ui?: IBusinessUi;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessUiSchema = new Schema<IBusinessUi>(
  {
    themeMode: { type: String, enum: ['light', 'dark'], default: 'light' },
    primaryColor: { type: String, default: '#3787F6' },
    sidebarColor: { type: String, default: '#0F172A' },
    backgroundColor: { type: String, default: '#F6F8FB' },
    logoUrl: { type: String, default: '' },
    dashboardLayout: { type: String, enum: ['classic', 'compact'], default: 'classic' },
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
    ui: { type: BusinessUiSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const Business = model<IBusiness>('Business', BusinessSchema);
