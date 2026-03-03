import { requireUser } from "~/services/session.server";
import { Booking } from "~/models/booking.server";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("bookingId");
  if (!bookingId) return Response.json({ error: "Missing bookingId" }, { status: 400 });

  const booking = await Booking.findOne({ booking_id: bookingId, user_id: user._id.toString() });
  if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

  const endTime = booking.actual_end_time || booking.end_time;
  const now = new Date();
  const remainingMs = endTime.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));
  const totalMinutes = booking.total_hours * 60;

  return Response.json({
    booking_id: booking.booking_id,
    status: booking.status,
    end_time: endTime.toISOString(),
    remaining_minutes: remainingMinutes,
    total_minutes: totalMinutes,
    is_expired: remainingMs <= 0,
    is_warning: remainingMinutes <= 15,
  });
}
