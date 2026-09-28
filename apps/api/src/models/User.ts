import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'super_admin' | 'owner' | 'staff' | 'client';

export type UserStatus = 'active' | 'disabled';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  /** Display name (optional; may be empty for legacy accounts). */
  name?: string;
  phone?: string;
  status: UserStatus;
  lastLoginAt?: Date;
  businessId?: Types.ObjectId; // נוסיף בהמשך קשר ל-Business
  /** Set whenever the user's own password is changed (not on reset-token issuance).
   *  Any JWT issued before this timestamp is rejected — see middleware/auth.ts —
   *  so changing a password invalidates every other outstanding session. */
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true },
    role: { type: String, enum: ['super_admin', 'owner', 'staff', 'client'], default: 'owner' },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      index: true,
    },
    lastLoginAt: { type: Date },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business' },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
