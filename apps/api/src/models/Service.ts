import { Schema, model,Types, Document } from 'mongoose';

export interface IService extends Document {
  businessId: Types.ObjectId;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    description: String,
    durationMinutes: { type: Number, required: true, default: 60 },
    price: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Service = model<IService>('Service', ServiceSchema);
