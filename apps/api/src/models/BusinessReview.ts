import { Schema, model, Types, Document } from 'mongoose';

export interface IBusinessReview extends Document {
  businessId: Types.ObjectId;
  customerName: string;
  text: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessReviewSchema = new Schema<IBusinessReview>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    customerName: { type: String, required: true, trim: true, maxlength: 120 },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true }
);

BusinessReviewSchema.index({ businessId: 1, createdAt: -1 });

export const BusinessReview = model<IBusinessReview>('BusinessReview', BusinessReviewSchema);
