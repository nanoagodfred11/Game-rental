import { randomBytes } from "crypto";

function randomChars(n: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(n);
  return Array.from(bytes).map(b => chars[b % chars.length]).join("");
}

function datePart(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export function generateBookingId(): string {
  return `BK-${datePart()}-${randomChars(4)}`;
}

export function generatePaymentId(): string {
  return `PAY-${datePart()}-${randomChars(4)}`;
}

export function generateEquipmentId(number: number): string {
  return `PS5-${String(number).padStart(3, "0")}`;
}

export function generateNotificationId(): string {
  return `NOTIF-${datePart()}-${randomChars(4)}`;
}

export function generateReviewId(): string {
  return `REV-${datePart()}-${randomChars(4)}`;
}

export function generateWaitlistId(): string {
  return `WL-${datePart()}-${randomChars(4)}`;
}

export function generateAuditId(): string {
  return `AUD-${datePart()}-${randomChars(4)}`;
}

export function calculateBookingAmount(hours: number, hourlyRate: number): number {
  return hours * hourlyRate;
}
