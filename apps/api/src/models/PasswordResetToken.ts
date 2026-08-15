import { Schema, model, Document, Types } from 'mongoose';

export interface IPasswordResetToken extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken = model<IPasswordResetToken>(
  'PasswordResetToken',
  PasswordResetTokenSchema
);
