import { z } from "zod";

// Auth
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
  phone_number: z.string().min(10, "Phone number must be at least 10 digits").max(15),
  hostel_name: z.string().min(1, "Hostel name is required"),
  room_number: z.string().min(1, "Room number is required"),
});

// Booking
export const bookingCreateSchema = z.object({
  equipment_id: z.string().min(1, "Equipment is required"),
  booking_date: z.string().min(1, "Booking date is required"),
  start_time: z.string().min(1, "Start time is required"),
  hours: z.coerce.number().min(2, "Minimum 2 hours").max(6, "Maximum 6 hours"),
  promo_code: z.string().optional(),
});

export const bookingExtendSchema = z.object({
  additional_hours: z.coerce.number().min(1, "Minimum 1 hour").max(4, "Maximum 4 hours"),
});

export const bookingStatusUpdateSchema = z.object({
  status: z.enum(["pending", "payment_received", "confirmed", "delivered", "awaiting_confirmation", "in_use", "extended", "completed", "cancelled", "refunded"]),
  admin_notes: z.string().optional(),
});

// Payment
export const paymentConfirmSchema = z.object({
  momo_number_from: z.string().min(10, "Phone number must be at least 10 digits").max(15),
  momo_transaction_id: z.string().min(5, "Transaction ID must be at least 5 characters"),
});

export const paymentVerifySchema = z.object({
  status: z.enum(["completed", "failed", "refunded"]),
  notes: z.string().optional(),
});

// Review
export const reviewCreateSchema = z.object({
  booking_id: z.string().min(1, "Booking ID is required"),
  rating: z.coerce.number().min(1).max(5),
  title: z.string().max(100).optional(),
  comment: z.string().max(500).optional(),
  equipment_condition: z.coerce.number().min(1).max(5).optional(),
  delivery_speed: z.coerce.number().min(1).max(5).optional(),
  value_for_money: z.coerce.number().min(1).max(5).optional(),
});

export const adminReviewResponseSchema = z.object({
  response: z.string().min(1).max(500),
});

// Promo Code
export const promoCodeCreateSchema = z.object({
  code: z.string().min(3).max(20),
  name: z.string().min(1),
  description: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed", "free_hours"]),
  discount_value: z.coerce.number().positive(),
  min_hours: z.coerce.number().min(1).default(1),
  max_discount: z.coerce.number().positive().optional(),
  max_uses: z.coerce.number().positive().optional(),
  max_uses_per_user: z.coerce.number().min(1).default(1),
  allowed_emails: z.string().optional(), // comma-separated
  first_booking_only: z.coerce.boolean().default(false),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
});

export const promoCodeValidateSchema = z.object({
  code: z.string().min(1),
  hours: z.coerce.number().min(1),
});

// Equipment (admin)
export const equipmentCreateSchema = z.object({
  name: z.string().min(1),
  equipment_id: z.string().min(1),
  description: z.string().optional(),
  components: z.string().optional(), // comma-separated
  hourly_rate: z.coerce.number().positive().default(70),
});

export const equipmentUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["available", "booked", "in_use", "maintenance", "delivered"]).optional(),
  hourly_rate: z.coerce.number().positive().optional(),
});

// Profile
export const profileUpdateSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone_number: z.string().min(10).max(15).optional(),
  hostel_name: z.string().optional(),
  room_number: z.string().optional(),
});

// Password reset (admin)
export const passwordResetSchema = z.object({
  user_email: z.string().email(),
  new_password: z.string().min(8),
});

// Waitlist
export const waitlistCreateSchema = z.object({
  preferred_date: z.string().min(1),
  preferred_hours: z.coerce.number().min(2).max(6),
  flexible_hours: z.coerce.boolean().default(true),
  notes: z.string().optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingExtendInput = z.infer<typeof bookingExtendSchema>;
export type PaymentConfirmInput = z.infer<typeof paymentConfirmSchema>;
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type PromoCodeCreateInput = z.infer<typeof promoCodeCreateSchema>;
export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type WaitlistCreateInput = z.infer<typeof waitlistCreateSchema>;
