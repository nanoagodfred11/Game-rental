import mongoose, { type Document } from "mongoose";
const { Schema, model, models } = mongoose;

export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED = "fixed",
  FREE_HOURS = "free_hours",
}

export interface IPromoCode extends Document {
  code: string;
  name: string;
  description: string;

  discount_type: DiscountType;
  discount_value: number;

  min_hours: number;
  max_discount: number;

  max_uses: number;
  max_uses_per_user: number;
  current_uses: number;
  used_by: string[];

  allowed_emails: string[];
  first_booking_only: boolean;

  valid_from: Date;
  valid_until: Date;

  is_active: boolean;

  created_at: Date;
  created_by: string;
}

const promoCodeSchema = new Schema<IPromoCode>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Discount
    discount_type: {
      type: String,
      enum: Object.values(DiscountType),
      required: true,
    },
    discount_value: {
      type: Number,
      required: true,
    },

    // Constraints
    min_hours: {
      type: Number,
      default: 1,
    },
    max_discount: {
      type: Number,
    },

    // Usage
    max_uses: {
      type: Number,
    },
    max_uses_per_user: {
      type: Number,
      default: 1,
    },
    current_uses: {
      type: Number,
      default: 0,
    },
    used_by: {
      type: [String],
      default: [],
    },

    // Restrictions
    allowed_emails: {
      type: [String],
      default: [],
    },
    first_booking_only: {
      type: Boolean,
      default: false,
    },

    // Validity
    valid_from: {
      type: Date,
      default: Date.now,
    },
    valid_until: {
      type: Date,
    },

    // Status
    is_active: {
      type: Boolean,
      default: true,
    },

    // Timestamps
    created_at: {
      type: Date,
      default: Date.now,
    },
    created_by: {
      type: String,
    },
  },
  {
    collection: "promo_codes",
  }
);

export const PromoCode =
  models.PromoCode || model<IPromoCode>("PromoCode", promoCodeSchema);
