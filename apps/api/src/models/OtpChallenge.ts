import { Schema, model, Document } from 'mongoose';

export interface IOtpChallenge extends Document {
  businessSlug: string;
  phone: string;
  code: string;
  firstName?: string;
  lastName?: string;
  expiresAt: Date;
  createdAt: Date;
}

const OtpChallengeSchema = new Schema<IOtpChallenge>(
  {
    businessSlug: { type: String, required: true },
    phone: { type: String, required: true },
    code: { type: String, required: true },
    firstName: String,
    lastName: String,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

OtpChallengeSchema.index({ businessSlug: 1, phone: 1 }, { unique: true });
OtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpChallenge = model<IOtpChallenge>('OtpChallenge', OtpChallengeSchema);
