import { requireUser } from "~/services/session.server";
import { Booking } from "~/models/booking.server";
import { Notification } from "~/models/notification.server";
import { generateNotificationId } from "~/lib/utils.server";

export async function action({ request, params }: { request: Request; params: { bookingId: string } }) {
  const user = await requireUser(request);
  const booking = await Booking.findOne({ booking_id: params.bookingId, user_id: user._id.toString() });
  if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "delivered") return Response.json({ error: "Booking is not in delivered status" }, { status: 400 });

  const formData = await request.formData();
  const photo = formData.get("photo") as string;
  if (!photo) return Response.json({ error: "Photo is required" }, { status: 400 });

  booking.delivery_photo_url = photo;
  booking.delivery_confirmed_at = new Date();
  booking.status = "awaiting_confirmation" as any;
  booking.updated_at = new Date();
  await booking.save();

  // Create admin notification
  await Notification.create({
    notification_id: generateNotificationId(),
    is_admin_notification: true,
    notification_type: "delivery_confirmed",
    title: "Delivery Photo Uploaded",
    message: `Customer uploaded delivery photo for booking ${booking.booking_id}`,
    booking_id: booking.booking_id,
  });

  return Response.json({ success: true, booking_id: booking.booking_id });
}
