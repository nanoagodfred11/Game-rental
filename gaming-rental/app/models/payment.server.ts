import mongoose, { type Document } from "mongoose";
const { Schema, model, models } = mongoose;

export enum PaymentType {
  BOOKING = "booking",
  EXTENSION = "extension",
}

export enum PaymentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export interface IPayment extends Document {
  payment_id: string;
  user_id: string;
  user_email: string;
  user_phone: string;
  booking_id: string;

  payment_type: PaymentType;
  amount: number;
  currency: string;

  momo_number_to: string;
  momo_name_to: string;
  momo_number_from: string;
  momo_transaction_id: string;

  status: PaymentStatus;

  verified_by: string;
  verified_at: Date;
  notes: string;

  created_at: Date;
  updated_at: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    payment_id: {
      type: String,
      required: true,
      unique: true,
    },
    user_id: {
      type: String,
      required: true,
    },
    user_email: {
      type: String,
      required: true,
    },
    user_phone: {
      type: String,
      required: true,
    },
    booking_id: {
      type: String,
      required: true,
    },

    // Payment details
    payment_type: {
      type: String,
      enum: Object.values(PaymentType),
      default: PaymentType.BOOKING,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "GHS",
    },

    // MoMo details
    momo_number_to: {
      type: String,
    },
    momo_name_to: {
      type: String,
    },
    momo_number_from: {
      type: String,
    },
    momo_transaction_id: {
      type: String,
    },

    // Status
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },

    // Verification
    verified_by: {
      type: String,
    },
    verified_at: {
      type: Date,
    },
    notes: {
      type: String,
    },

    // Timestamps
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "payments",
  }
);

paymentSchema.pre("save", function () {
  this.updated_at = new Date();
});

export const Payment =
  models.Payment || model<IPayment>("Payment", paymentSchema);
