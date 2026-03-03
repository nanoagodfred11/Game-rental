import mongoose, { type Document } from "mongoose";
const { Schema, model, models } = mongoose;

export enum EquipmentStatus {
  AVAILABLE = "available",
  BOOKED = "booked",
  IN_USE = "in_use",
  MAINTENANCE = "maintenance",
  DELIVERED = "delivered",
}

export interface IEquipment extends Document {
  name: string;
  equipment_id: string;
  description: string;
  components: string[];
  status: EquipmentStatus;
  current_booking_id: string | null;
  hourly_rate: number;
  total_bookings: number;
  total_hours_rented: number;
  total_revenue: number;
  created_at: Date;
  updated_at: Date;
  last_maintenance: Date;
}

const DEFAULT_COMPONENTS = [
  "PlayStation 5 Console",
  "DualSense Controller x2",
  "32-inch TV",
  "HDMI Cable",
  "Power Strip",
];

const equipmentSchema = new Schema<IEquipment>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    equipment_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: "PlayStation 5 with TV and 2 controllers",
    },
    components: {
      type: [String],
      default: DEFAULT_COMPONENTS,
    },
    status: {
      type: String,
      enum: Object.values(EquipmentStatus),
      default: EquipmentStatus.AVAILABLE,
    },
    current_booking_id: {
      type: String,
      default: null,
    },
    hourly_rate: {
      type: Number,
      default: 70,
    },
    total_bookings: {
      type: Number,
      default: 0,
    },
    total_hours_rented: {
      type: Number,
      default: 0,
    },
    total_revenue: {
      type: Number,
      default: 0,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    last_maintenance: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "equipment",
  }
);

equipmentSchema.pre("save", function () {
  this.updated_at = new Date();
});

export const Equipment =
  models.Equipment || model<IEquipment>("Equipment", equipmentSchema);
