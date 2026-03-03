import mongoose, { type Document } from "mongoose";
const { Schema, model, models } = mongoose;

export interface IReview extends Document {
  review_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  booking_id: string;
  equipment_id: string;
  equipment_name: string;

  rating: number;
  title: string;
  comment: string;

  equipment_condition: number;
  delivery_speed: number;
  value_for_money: number;

  admin_response: string;
  responded_at: Date;

  is_visible: boolean;
  is_featured: boolean;

  created_at: Date;
  updated_at: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    review_id: {
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
    user_name: {
      type: String,
      required: true,
    },
    booking_id: {
      type: String,
      required: true,
      index: true,
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

    // Rating
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
    },
    comment: {
      type: String,
      trim: true,
    },

    // Sub-ratings (optional)
    equipment_condition: {
      type: Number,
      min: 1,
      max: 5,
    },
    delivery_speed: {
      type: Number,
      min: 1,
      max: 5,
    },
    value_for_money: {
      type: Number,
      min: 1,
      max: 5,
    },

    // Admin response
    admin_response: {
      type: String,
    },
    responded_at: {
      type: Date,
    },

    // Visibility
    is_visible: {
      type: Boolean,
      default: true,
    },
    is_featured: {
      type: Boolean,
      default: false,
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
    collection: "reviews",
  }
);

reviewSchema.pre("save", function () {
  this.updated_at = new Date();
});

export const Review = models.Review || model<IReview>("Review", reviewSchema);
