import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'super_admin' | 'owner' | 'staff' | 'client';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  businessId?: Types.ObjectId; // נוסיף בהמשך קשר ל-Business
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'owner', 'staff', 'client'], default: 'owner' },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business' },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
