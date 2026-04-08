import { Schema, model,Types, Document } from 'mongoose';
import {
  APPOINTMENT_SOURCES,
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '../dto/enums';

export type { AppointmentStatus };

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
  /** Free-text reason supplied by the customer when cancelling their own appointment. */
  cancellationReason?: string;
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
      enum: APPOINTMENT_STATUSES,
      default: 'confirmed',
      index: true,
    },
    source: {
      type: String,
      enum: APPOINTMENT_SOURCES,
      default: 'owner',
    },
    notes: String,
    cancellationReason: String,
  },
  { timestamps: true }
);

AppointmentSchema.index({ businessId: 1, status: 1, start: 1, end: 1 });

export const Appointment = model<IAppointment>('Appointment', AppointmentSchema);
