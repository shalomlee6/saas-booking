import { Schema, model,Types, Document } from 'mongoose';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface IAppointment extends Document {
  businessId: Types.ObjectId;
  serviceId: Types.ObjectId;
  customerId?: Types.ObjectId;
  customerName?: string;
  customerPhone?: string;
  /** Snapshot from service at creation time */
  price?: number;
  /** Snapshot from service at creation time (minutes) */
  durationMinutes?: number;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  source: 'owner' | 'client-online';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: false,
    },
    customerName: String,
    customerPhone: String,
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    price: Number,
    durationMinutes: Number,
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    source: {
      type: String,
      enum: ['owner', 'client-online'],
      default: 'owner',
    },
    notes: String,
  },
  { timestamps: true }
);

AppointmentSchema.index({ businessId: 1, status: 1, start: 1, end: 1 });

export const Appointment = model<IAppointment>('Appointment', AppointmentSchema);
