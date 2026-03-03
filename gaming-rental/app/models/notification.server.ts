import mongoose, { type Document } from "mongoose";
const { Schema, model, models } = mongoose;

export enum NotificationType {
  BOOKING_CREATED = "booking_created",
  PAYMENT_RECEIVED = "payment_received",
  BOOKING_CONFIRMED = "booking_confirmed",
  EQUIPMENT_DELIVERED = "equipment_delivered",
  SESSION_STARTING = "session_starting",
  SESSION_ENDING = "session_ending",
  SESSION_EXTENDED = "session_extended",
  SESSION_COMPLETED = "session_completed",
  BOOKING_CANCELLED = "booking_cancelled",
  PROMO_APPLIED = "promo_applied",
}

export interface INotification extends Document {
  notification_id: string;
  user_id: string;
  user_email: string;
  is_admin_notification: boolean;

  notification_type: NotificationType;
  title: string;
  message: string;
  booking_id: string;

  is_read: boolean;
  read_at: Date;

  created_at: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    notification_id: {
      type: String,
      required: true,
      unique: true,
    },
    user_id: {
      type: String,
      index: true,
    },
    user_email: {
      type: String,
    },
    is_admin_notification: {
      type: Boolean,
      default: false,
    },

    // Content
    notification_type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    booking_id: {
      type: String,
    },

    // Status
    is_read: {
      type: Boolean,
      default: false,
    },
    read_at: {
      type: Date,
    },

    // Timestamps
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "notifications",
  }
);

export const Notification =
  models.Notification ||
  model<INotification>("Notification", notificationSchema);
