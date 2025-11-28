import { Schema, model,Types, Document } from 'mongoose';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface IAppointment extends Document {
  businessId:  Types.ObjectId;
  customerId: Types.ObjectId;
  serviceId: Types.ObjectId;
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
      required: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
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

export const Appointment = model<IAppointment>('Appointment', AppointmentSchema);
