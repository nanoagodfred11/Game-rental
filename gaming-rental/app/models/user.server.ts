import mongoose, { type Document } from "mongoose";
const { Schema, model, models } = mongoose;

export enum UserRole {
  CUSTOMER = "customer",
  ADMIN = "admin",
}

export interface IUser extends Document {
  email: string;
  hashed_password: string;
  full_name: string;
  phone_number: string;
  hostel_name: string;
  room_number: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  total_bookings: number;
  total_hours_rented: number;
  total_amount_spent: number;
  loyalty_points: number;
  last_booking_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export function getLoyaltyTier(points: number): LoyaltyTier {
  if (points >= 1000) return "platinum";
  if (points >= 500) return "gold";
  if (points >= 200) return "silver";
  return "bronze";
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    hashed_password: {
      type: String,
      required: true,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
    },
    phone_number: {
      type: String,
      required: true,
      trim: true,
    },
    hostel_name: {
      type: String,
      required: true,
      trim: true,
    },
    room_number: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_verified: {
      type: Boolean,
      default: false,
    },
    total_bookings: {
      type: Number,
      default: 0,
    },
    total_hours_rented: {
      type: Number,
      default: 0,
    },
    total_amount_spent: {
      type: Number,
      default: 0,
    },
    loyalty_points: {
      type: Number,
      default: 0,
    },
    last_booking_at: {
      type: Date,
      default: null,
    },
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
    collection: "users",
  }
);

userSchema.pre("save", function () {
  this.updated_at = new Date();
});

export const User = models.User || model<IUser>("User", userSchema);
