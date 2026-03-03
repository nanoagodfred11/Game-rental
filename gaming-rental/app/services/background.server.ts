import { Booking } from "~/models/booking.server";
import { Equipment } from "~/models/equipment.server";
import { User } from "~/models/user.server";
import { Notification } from "~/models/notification.server";
import { Waitlist } from "~/models/waitlist.server";
import { generateNotificationId } from "~/lib/utils.server";

let intervalId: ReturnType<typeof setInterval> | null = null;

async function runBackgroundTasks() {
  try {
    const now = new Date();

    // 1. Auto-complete expired sessions
    const expiredSessions = await Booking.find({
      status: { $in: ["in_use", "extended"] },
      $or: [
        { actual_end_time: { $lte: now } },
        { actual_end_time: null, end_time: { $lte: now } },
      ],
    });

    for (const booking of expiredSessions) {
      booking.status = "completed" as any;
      booking.completed_at = now;
      booking.updated_at = now;
      await booking.save();

      // Free equipment
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id },
        { $set: { status: "available", current_booking_id: null, updated_at: now } }
      );

      // Update user stats
      await User.updateOne(
        { _id: booking.user_id },
        {
          $inc: {
            total_bookings: 1,
            total_hours_rented: booking.total_hours || booking.hours_booked,
            total_amount_spent: booking.total_amount,
            loyalty_points: booking.total_amount,
          },
          $set: { last_booking_at: now, updated_at: now },
        }
      );

      // Notify user
      await Notification.create({
        notification_id: generateNotificationId(),
        user_id: booking.user_id,
        notification_type: "session_completed",
        title: "Session Completed",
        message: `Your gaming session (${booking.booking_id}) has ended. Thank you for playing!`,
        booking_id: booking.booking_id,
      });
    }

    // 2. Cancel stale delivered bookings (>24h)
    const staleDelivered = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleDeliveredBookings = await Booking.find({
      status: { $in: ["delivered", "awaiting_confirmation"] },
      delivered_at: { $lte: staleDelivered },
    });

    for (const booking of staleDeliveredBookings) {
      booking.status = "cancelled" as any;
      booking.cancelled_at = now;
      booking.updated_at = now;
      await booking.save();
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id },
        { $set: { status: "available", current_booking_id: null, updated_at: now } }
      );
    }

    // 3. Refund stale confirmed bookings (start_time >24h ago)
    const staleConfirmed = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleConfirmedBookings = await Booking.find({
      status: "confirmed",
      start_time: { $lte: staleConfirmed },
    });

    for (const booking of staleConfirmedBookings) {
      booking.status = "refunded" as any;
      booking.updated_at = now;
      await booking.save();
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id },
        { $set: { status: "available", current_booking_id: null, updated_at: now } }
      );
      await Notification.create({
        notification_id: generateNotificationId(),
        user_id: booking.user_id,
        notification_type: "booking_cancelled",
        title: "Booking Auto-Refunded",
        message: `Your booking ${booking.booking_id} has been auto-refunded as the start time passed without delivery.`,
        booking_id: booking.booking_id,
      });
    }

    // 4. Delete old read notifications (>30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await Notification.deleteMany({
      is_read: true,
      read_at: { $lte: thirtyDaysAgo },
    });

    // 5. Expire old waitlist entries (preferred_date >7 days ago)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await Waitlist.updateMany(
      { status: "waiting", preferred_date: { $lte: sevenDaysAgo } },
      { $set: { status: "expired", updated_at: now } }
    );

  } catch (error) {
    console.error("Background worker error:", error);
  }
}

export function startBackgroundWorker() {
  if (intervalId) return;
  console.log("Background worker started (30s interval)");
  intervalId = setInterval(runBackgroundTasks, 30000);
  // Run immediately on startup
  runBackgroundTasks();
}

export function stopBackgroundWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("Background worker stopped");
  }
}
