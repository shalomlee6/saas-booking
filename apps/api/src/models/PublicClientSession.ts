import { Schema, model, Types, Document } from 'mongoose';

/** One device session can remember a different client on each business. */
export interface IPublicClientBinding {
  businessId: Types.ObjectId;
  slug: string;
  phone: string;
  customerId?: Types.ObjectId;
  verified: boolean;
}

export interface IPublicClientSession extends Document {
  sessionId: string;
  bindings: IPublicClientBinding[];
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PublicClientBindingSchema = new Schema<IPublicClientBinding>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    slug: { type: String, required: true },
    phone: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    verified: { type: Boolean, required: true },
  },
  { _id: false }
);

const PublicClientSessionSchema = new Schema<IPublicClientSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    bindings: { type: [PublicClientBindingSchema], required: true, default: [] },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
  },
  { timestamps: true }
);

PublicClientSessionSchema.index({ 'bindings.businessId': 1 });

export const PublicClientSession = model<IPublicClientSession>(
  'PublicClientSession',
  PublicClientSessionSchema
);
