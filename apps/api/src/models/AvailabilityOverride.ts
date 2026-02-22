import { Schema, model, Types, Document } from 'mongoose';

export type AvailabilityOverrideType = 'closed' | 'custom';

export interface IAvailabilityOverrideRange {
  start: string; // "HH:mm"
  end: string;
}

export interface IAvailabilityOverride extends Document {
  businessId: Types.ObjectId;
  date: string; // YYYY-MM-DD in business timezone
  type: AvailabilityOverrideType;
  ranges: IAvailabilityOverrideRange[];
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AvailabilityOverrideSchema = new Schema<IAvailabilityOverride>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    date: { type: String, required: true },
    type: {
      type: String,
      enum: ['closed', 'custom'],
      required: true,
    },
    ranges: {
      type: [{ start: String, end: String }],
      default: [],
    },
    note: String,
  },
  { timestamps: true }
);

AvailabilityOverrideSchema.index({ businessId: 1, date: 1 }, { unique: true });

export const AvailabilityOverride = model<IAvailabilityOverride>(
  'AvailabilityOverride',
  AvailabilityOverrideSchema
);
