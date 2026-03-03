// These are shared client/server constants with sensible defaults.
// Server-side code can override with env vars in loaders/actions.
export const HOURLY_RATE = 70;
export const CURRENCY = "GHS";
export const MIN_BOOKING_HOURS = 2;
export const MAX_BOOKING_HOURS = 6;
export const MAX_TOTAL_HOURS = 10;
export const MOMO_NUMBER = "0592005318";
export const MOMO_NAME = "NANOA GODFRED";

// Booking status transition matrix
export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["payment_received", "cancelled"],
  payment_received: ["confirmed", "cancelled", "refunded"],
  confirmed: ["delivered", "cancelled", "refunded"],
  delivered: ["in_use", "awaiting_confirmation", "cancelled"],
  awaiting_confirmation: ["in_use", "cancelled"],
  in_use: ["completed", "extended"],
  extended: ["completed", "extended"],
  completed: [],
  cancelled: [],
  refunded: [],
};

// Loyalty tiers
export function calculateLoyaltyTier(totalSpent: number): string {
  if (totalSpent >= 5000) return "Platinum";
  if (totalSpent >= 2000) return "Gold";
  if (totalSpent >= 500) return "Silver";
  return "Bronze";
}

export function formatCurrency(amount: number): string {
  return `GH₵ ${amount.toLocaleString()}`;
}
