import mongoose, { type Document } from "mongoose";
const { Schema, model, models } = mongoose;

export enum WaitlistStatus {
  WAITING = "waiting",
  NOTIFIED = "notified",
  BOOKED = "booked",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

export interface IWaitlist extends Document {
  waitlist_id: string;
  user_id: string;
  user_email: string;
  user_phone: string;

  preferred_date: Date;
  preferred_hours: number;
  flexible_hours: boolean;

  status: WaitlistStatus;
  notified_at: Date;
  notification_expires_at: Date;

  notes: string;

  created_at: Date;
  updated_at: Date;
}

const waitlistSchema = new Schema<IWaitlist>(
  {
    waitlist_id: {
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

    // Booking preferences
    preferred_date: {
      type: Date,
      required: true,
      index: true,
    },
    preferred_hours: {
      type: Number,
      required: true,
    },
    flexible_hours: {
      type: Boolean,
      default: true,
    },

    // Status
    status: {
      type: String,
      enum: Object.values(WaitlistStatus),
      default: WaitlistStatus.WAITING,
      index: true,
    },
    notified_at: {
      type: Date,
    },
    notification_expires_at: {
      type: Date,
    },

    // Notes
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
    collection: "waitlist",
  }
);

waitlistSchema.pre("save", function () {
  this.updated_at = new Date();
});

export const Waitlist =
  models.Waitlist || model<IWaitlist>("Waitlist", waitlistSchema);
