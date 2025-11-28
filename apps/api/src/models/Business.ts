import { Schema, model, Types, Document } from 'mongoose';

export interface IBusiness extends Document {
  ownerId: Types.ObjectId;
  name: string;
  phone?: string;
  address?: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    phone: String,
    address: String,
    slug: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export const Business = model<IBusiness>('Business', BusinessSchema);
