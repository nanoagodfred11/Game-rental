import { requireUser } from "~/services/session.server";
import { PromoCode } from "~/models/promo-code.server";
import { Booking } from "~/models/booking.server";
import { HOURLY_RATE } from "~/lib/constants";

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const code = (formData.get("code") as string)?.toUpperCase().trim();
  const hours = Number(formData.get("hours")) || 2;

  if (!code) return Response.json({ valid: false, message: "Code is required" });

  const promo = await PromoCode.findOne({ code, is_active: true });
  if (!promo) return Response.json({ valid: false, message: "Invalid promo code" });

  const now = new Date();
  if (promo.valid_until && now > promo.valid_until) {
    return Response.json({ valid: false, message: "Promo code has expired" });
  }
  if (promo.valid_from && now < promo.valid_from) {
    return Response.json({ valid: false, message: "Promo code is not yet active" });
  }
  if (promo.max_uses && promo.current_uses >= promo.max_uses) {
    return Response.json({ valid: false, message: "Promo code has reached maximum uses" });
  }

  const userId = user._id.toString();
  const userUses = promo.used_by.filter((id: string) => id === userId).length;
  if (userUses >= promo.max_uses_per_user) {
    return Response.json({ valid: false, message: "You have already used this promo code" });
  }
  if (promo.allowed_emails.length > 0 && !promo.allowed_emails.includes(user.email)) {
    return Response.json({ valid: false, message: "This promo code is not available for your account" });
  }
  if (promo.first_booking_only) {
    const existingBookings = await Booking.countDocuments({ user_id: userId, status: { $nin: ["cancelled"] } });
    if (existingBookings > 0) {
      return Response.json({ valid: false, message: "This code is only valid for first-time bookings" });
    }
  }
  if (hours < promo.min_hours) {
    return Response.json({ valid: false, message: `Minimum ${promo.min_hours} hours required for this code` });
  }

  const originalAmount = hours * HOURLY_RATE;
  let discountAmount = 0;
  let description = "";

  if (promo.discount_type === "percentage") {
    discountAmount = Math.floor(originalAmount * promo.discount_value / 100);
    if (promo.max_discount) discountAmount = Math.min(discountAmount, promo.max_discount);
    description = `${promo.discount_value}% off`;
  } else if (promo.discount_type === "fixed") {
    discountAmount = Math.min(promo.discount_value, originalAmount);
    description = `GH₵${promo.discount_value} off`;
  } else if (promo.discount_type === "free_hours") {
    discountAmount = promo.discount_value * HOURLY_RATE;
    description = `${promo.discount_value} free hour(s)`;
  }

  return Response.json({
    valid: true,
    code: promo.code,
    message: `Promo applied: ${description}`,
    discount_amount: discountAmount,
    original_amount: originalAmount,
    final_amount: originalAmount - discountAmount,
    discount_description: description,
  });
}
