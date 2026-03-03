import mongoose, { type Document } from "mongoose";
const { Schema, model, models } = mongoose;

export enum BookingStatus {
  PENDING = "pending",
  PAYMENT_RECEIVED = "payment_received",
  CONFIRMED = "confirmed",
  DELIVERED = "delivered",
  AWAITING_CONFIRMATION = "awaiting_confirmation",
  IN_USE = "in_use",
  EXTENDED = "extended",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
}

export interface IBooking extends Document {
  booking_id: string;
  user_id: string;
  user_email: string;
  user_phone: string;
  equipment_id: string;
  equipment_name: string;
  hostel_name: string;
  room_number: string;

  booking_date: Date;
  start_time: Date;
  end_time: Date;
  hours_booked: number;
  original_end_time: Date;
  extension_hours: number;
  total_hours: number;

  pending_extension_hours: number;
  pending_extension_amount: number;
  pending_extension_payment_id: string;

  hourly_rate: number;
  base_amount: number;
  extension_amount: number;
  total_amount: number;
  promo_code_used: string;
  discount_amount: number;

  status: BookingStatus;
  is_paid: boolean;
  payment_id: string;
  extension_payment_id: string;
  confirmed_at: Date;

  delivery_photo_url: string;
  delivery_confirmed_at: Date;
  actual_start_time: Date;
  actual_end_time: Date;

  admin_notes: string;

  created_at: Date;
  updated_at: Date;
  delivered_at: Date;
  completed_at: Date;
  cancelled_at: Date;

  user_notified_payment: boolean;
  user_notified_delivery: boolean;
}

const bookingSchema = new Schema<IBooking>(
  {
    booking_id: {
      type: String,
      required: true,
      unique: true,
    },
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    user_email: {
      type: String,
      required: true,
    },
    user_phone: {
      type: String,
      required: true,
    },
    equipment_id: {
      type: String,
      required: true,
      index: true,
    },
    equipment_name: {
      type: String,
      required: true,
    },
    hostel_name: {
      type: String,
      required: true,
    },
    room_number: {
      type: String,
      required: true,
    },

    // Times
    booking_date: {
      type: Date,
      required: true,
    },
    start_time: {
      type: Date,
      required: true,
      index: true,
    },
    end_time: {
      type: Date,
      required: true,
    },
    hours_booked: {
      type: Number,
      required: true,
    },
    original_end_time: {
      type: Date,
    },
    extension_hours: {
      type: Number,
      default: 0,
    },
    total_hours: {
      type: Number,
      default: 0,
    },

    // Pending extension
    pending_extension_hours: {
      type: Number,
      default: 0,
    },
    pending_extension_amount: {
      type: Number,
      default: 0,
    },
    pending_extension_payment_id: {
      type: String,
    },

    // Pricing
    hourly_rate: {
      type: Number,
      default: 70,
    },
    base_amount: {
      type: Number,
      default: 0,
    },
    extension_amount: {
      type: Number,
      default: 0,
    },
    total_amount: {
      type: Number,
      default: 0,
    },
    promo_code_used: {
      type: String,
    },
    discount_amount: {
      type: Number,
      default: 0,
    },

    // Status
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
      index: true,
    },
    is_paid: {
      type: Boolean,
      default: false,
    },
    payment_id: {
      type: String,
    },
    extension_payment_id: {
      type: String,
    },
    confirmed_at: {
      type: Date,
    },

    // Delivery
    delivery_photo_url: {
      type: String,
    },
    delivery_confirmed_at: {
      type: Date,
    },
    actual_start_time: {
      type: Date,
    },
    actual_end_time: {
      type: Date,
    },

    // Admin
    admin_notes: {
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
    delivered_at: {
      type: Date,
    },
    completed_at: {
      type: Date,
    },
    cancelled_at: {
      type: Date,
    },

    // Notification flags
    user_notified_payment: {
      type: Boolean,
      default: false,
    },
    user_notified_delivery: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: "bookings",
  }
);

bookingSchema.pre("save", function () {
  this.updated_at = new Date();
});

export const Booking =
  models.Booking || model<IBooking>("Booking", bookingSchema);
