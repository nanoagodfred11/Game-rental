import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { data } from "react-router";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Textarea,
  Divider,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import {
  ChevronLeft,
  Gamepad2,
  Calendar,
  Clock,
  MapPin,
  CreditCard,
  User as UserIcon,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Camera,
  ScrollText,
  FileText,
} from "lucide-react";
import { useState } from "react";

import { requireAdmin } from "~/services/session.server";
import { Booking, BookingStatus } from "~/models/booking.server";
import { Payment } from "~/models/payment.server";
import { Equipment } from "~/models/equipment.server";
import { User } from "~/models/user.server";
import { Notification, NotificationType } from "~/models/notification.server";
import { AuditLog, type IAuditLog } from "~/models/audit-log.server";
import { VALID_TRANSITIONS, formatCurrency } from "~/lib/constants";
import { generateNotificationId } from "~/lib/utils.server";
import { bookingStatusUpdateSchema } from "~/lib/validation";
import StatusBadge from "~/components/ui/status-badge";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { bookingId: string };
}) {
  await requireAdmin(request);

  const booking = await Booking.findOne({ booking_id: params.bookingId }).lean();
  if (!booking) {
    throw data("Booking not found", { status: 404 });
  }

  // Get associated payments
  const payments = await Payment.find({ booking_id: booking.booking_id })
    .sort({ created_at: -1 })
    .lean();

  // Get user info
  const user = await User.findById(booking.user_id).lean();

  // Get audit logs for this booking
  const auditLogs = await AuditLog.find({
    target_type: "booking",
    target_id: booking.booking_id,
  })
    .sort({ created_at: -1 })
    .lean();

  return {
    booking: {
      id: booking._id.toString(),
      booking_id: booking.booking_id,
      user_id: booking.user_id,
      user_email: booking.user_email,
      user_phone: booking.user_phone,
      equipment_name: booking.equipment_name,
      equipment_id: booking.equipment_id,
      hostel_name: booking.hostel_name,
      room_number: booking.room_number,
      booking_date: booking.booking_date.toISOString(),
      start_time: booking.start_time.toISOString(),
      end_time: booking.end_time.toISOString(),
      original_end_time: booking.original_end_time?.toISOString() || null,
      hours_booked: booking.hours_booked,
      extension_hours: booking.extension_hours,
      total_hours: booking.total_hours,
      hourly_rate: booking.hourly_rate,
      base_amount: booking.base_amount,
      extension_amount: booking.extension_amount,
      total_amount: booking.total_amount,
      discount_amount: booking.discount_amount,
      promo_code_used: booking.promo_code_used,
      status: booking.status,
      is_paid: booking.is_paid,
      payment_id: booking.payment_id,
      delivery_photo_url: booking.delivery_photo_url,
      delivery_confirmed_at: booking.delivery_confirmed_at?.toISOString() || null,
      actual_start_time: booking.actual_start_time?.toISOString() || null,
      actual_end_time: booking.actual_end_time?.toISOString() || null,
      admin_notes: booking.admin_notes,
      confirmed_at: booking.confirmed_at?.toISOString() || null,
      delivered_at: booking.delivered_at?.toISOString() || null,
      completed_at: booking.completed_at?.toISOString() || null,
      cancelled_at: booking.cancelled_at?.toISOString() || null,
      created_at: booking.created_at.toISOString(),
      updated_at: booking.updated_at.toISOString(),
    },
    user: user
      ? {
          id: user._id.toString(),
          email: user.email,
          full_name: user.full_name,
          phone_number: user.phone_number,
          hostel_name: user.hostel_name,
          room_number: user.room_number,
          total_bookings: user.total_bookings,
          total_amount_spent: user.total_amount_spent,
        }
      : null,
    payments: payments.map((p) => ({
      id: p._id.toString(),
      payment_id: p.payment_id,
      payment_type: p.payment_type,
      amount: p.amount,
      status: p.status,
      momo_number_from: p.momo_number_from,
      momo_transaction_id: p.momo_transaction_id,
      notes: p.notes,
      verified_by: p.verified_by,
      verified_at: p.verified_at?.toISOString() || null,
      created_at: p.created_at.toISOString(),
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log._id.toString(),
      action: log.action,
      actor_email: log.actor_email,
      details: log.details as Record<string, unknown>,
      previous_state: log.previous_state as Record<string, unknown>,
      new_state: log.new_state as Record<string, unknown>,
      created_at: log.created_at.toISOString(),
    })),
    validTransitions: VALID_TRANSITIONS,
  };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { bookingId: string };
}) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-status") {
    const result = bookingStatusUpdateSchema.safeParse(Object.fromEntries(formData));

    if (!result.success) {
      return data(
        { error: result.error.flatten().fieldErrors.status?.[0] || "Invalid status" },
        { status: 400 }
      );
    }

    const { status: newStatus, admin_notes } = result.data;

    const booking = await Booking.findOne({ booking_id: params.bookingId });
    if (!booking) {
      return data({ error: "Booking not found" }, { status: 404 });
    }

    const currentStatus = booking.status;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return data(
        { error: `Cannot transition from "${currentStatus}" to "${newStatus}"` },
        { status: 400 }
      );
    }

    const previousState = {
      status: booking.status,
      admin_notes: booking.admin_notes,
    };

    // Update booking status
    booking.status = newStatus as BookingStatus;
    if (admin_notes) {
      booking.admin_notes = admin_notes;
    }
    booking.updated_at = new Date();

    // Handle side effects
    if (newStatus === BookingStatus.CONFIRMED) {
      booking.confirmed_at = new Date();
    }

    if (newStatus === BookingStatus.DELIVERED) {
      booking.delivered_at = new Date();
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id },
        { status: "delivered", current_booking_id: booking.booking_id }
      );
    }

    if (newStatus === BookingStatus.IN_USE) {
      booking.actual_start_time = new Date();
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id },
        { status: "in_use", current_booking_id: booking.booking_id }
      );
    }

    if (newStatus === BookingStatus.COMPLETED) {
      booking.completed_at = new Date();
      booking.actual_end_time = new Date();
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id },
        {
          status: "available",
          current_booking_id: null,
          $inc: {
            total_bookings: 1,
            total_hours_rented: booking.total_hours,
            total_revenue: booking.total_amount,
          },
        }
      );
      await User.updateOne(
        { _id: booking.user_id },
        {
          $inc: {
            total_bookings: 1,
            total_hours_rented: booking.total_hours,
            total_amount_spent: booking.total_amount,
            loyalty_points: Math.floor(booking.total_amount / 10),
          },
          last_booking_at: new Date(),
        }
      );
    }

    if (newStatus === BookingStatus.CANCELLED) {
      booking.cancelled_at = new Date();
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id, current_booking_id: booking.booking_id },
        { status: "available", current_booking_id: null }
      );
    }

    if (newStatus === BookingStatus.REFUNDED) {
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id, current_booking_id: booking.booking_id },
        { status: "available", current_booking_id: null }
      );
    }

    await booking.save();

    // Create audit log
    await AuditLog.logAction({
      action: "booking_status_update",
      actor_id: admin._id.toString(),
      actor_email: admin.email,
      actor_role: admin.role,
      target_type: "booking",
      target_id: booking.booking_id,
      previous_state: previousState,
      new_state: { status: newStatus, admin_notes: admin_notes || "" },
      details: { from_status: currentStatus, to_status: newStatus },
    });

    // Create user notification
    const notificationMap: Record<string, { type: NotificationType; title: string; message: string }> = {
      [BookingStatus.PAYMENT_RECEIVED]: {
        type: NotificationType.PAYMENT_RECEIVED,
        title: "Payment Received",
        message: `Your payment for booking ${booking.booking_id} has been received.`,
      },
      [BookingStatus.CONFIRMED]: {
        type: NotificationType.BOOKING_CONFIRMED,
        title: "Booking Confirmed",
        message: `Your booking ${booking.booking_id} has been confirmed. Equipment will be delivered soon.`,
      },
      [BookingStatus.DELIVERED]: {
        type: NotificationType.EQUIPMENT_DELIVERED,
        title: "Equipment Delivered",
        message: `Equipment for booking ${booking.booking_id} has been delivered. Please confirm receipt.`,
      },
      [BookingStatus.IN_USE]: {
        type: NotificationType.SESSION_STARTING,
        title: "Session Started",
        message: `Your gaming session for booking ${booking.booking_id} has started. Enjoy!`,
      },
      [BookingStatus.COMPLETED]: {
        type: NotificationType.SESSION_COMPLETED,
        title: "Session Completed",
        message: `Your gaming session for booking ${booking.booking_id} has been completed. Thanks for renting!`,
      },
      [BookingStatus.CANCELLED]: {
        type: NotificationType.BOOKING_CANCELLED,
        title: "Booking Cancelled",
        message: `Your booking ${booking.booking_id} has been cancelled.${admin_notes ? ` Reason: ${admin_notes}` : ""}`,
      },
    };

    const notifConfig = notificationMap[newStatus];
    if (notifConfig) {
      await Notification.create({
        notification_id: generateNotificationId(),
        user_id: booking.user_id,
        user_email: booking.user_email,
        notification_type: notifConfig.type,
        title: notifConfig.title,
        message: notifConfig.message,
        booking_id: booking.booking_id,
      });
    }

    return { success: `Booking updated to "${newStatus}"` };
  }

  return data({ error: "Invalid action" }, { status: 400 });
}

export default function AdminBookingDetail() {
  const { booking, user, payments, auditLogs, validTransitions } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string; success?: string }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const transitionModal = useDisclosure();
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null);
  const [transitionNotes, setTransitionNotes] = useState("");

  const transitions = validTransitions[booking.status] || [];

  function openTransitionModal(newStatus: string) {
    setSelectedTransition(newStatus);
    setTransitionNotes("");
    transitionModal.onOpen();
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/admin/bookings"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Bookings
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{booking.equipment_name}</h1>
          <p className="text-gray-400 font-mono text-sm mt-1">{booking.booking_id}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Feedback Messages */}
      {actionData?.error && (
        <div className="bg-danger-500/10 border border-danger-500/30 text-danger-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {actionData.error}
        </div>
      )}
      {actionData?.success && (
        <div className="bg-success-500/10 border border-success-500/30 text-success-400 p-4 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          {actionData.success}
        </div>
      )}

      {/* Status Transition Controls */}
      {transitions.length > 0 && (
        <Card className="bg-surface-800 border-2 border-primary-500/30">
          <CardBody className="p-5">
            <p className="text-sm font-medium text-gray-400 mb-3">Transition Status:</p>
            <div className="flex flex-wrap gap-2">
              {transitions.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  color={
                    t === "cancelled" || t === "refunded"
                      ? "danger"
                      : t === "completed"
                        ? "success"
                        : "primary"
                  }
                  onPress={() => openTransitionModal(t)}
                  endContent={<ArrowRight className="h-3 w-3" />}
                >
                  {t.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Booking Details */}
          <Card className="bg-surface-800 border border-white/10">
            <CardHeader className="flex items-center gap-2 px-6 pt-6">
              <Gamepad2 className="h-5 w-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-white">Booking Details</h2>
            </CardHeader>
            <CardBody className="px-6 pb-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Equipment</p>
                    <p className="font-medium">{booking.equipment_name}</p>
                    <p className="text-xs text-gray-400">{booking.equipment_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {new Date(booking.booking_date).toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Time Slot</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {new Date(booking.start_time).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {new Date(booking.end_time).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Delivery Location</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {booking.hostel_name}, Room {booking.room_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Duration</p>
                    <p className="font-medium">
                      {booking.total_hours} hours
                      {booking.extension_hours > 0 && (
                        <span className="text-sm text-gray-400 ml-1">
                          ({booking.hours_booked}h + {booking.extension_hours}h ext.)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Created</p>
                    <p className="font-medium">
                      {new Date(booking.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Timestamps */}
              <Divider className="my-4" />
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Key Timestamps</h3>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {booking.confirmed_at && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary-500" />
                    Confirmed: {new Date(booking.confirmed_at).toLocaleString("en-GB")}
                  </div>
                )}
                {booking.delivered_at && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-secondary-500" />
                    Delivered: {new Date(booking.delivered_at).toLocaleString("en-GB")}
                  </div>
                )}
                {booking.actual_start_time && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
                    Session Start: {new Date(booking.actual_start_time).toLocaleString("en-GB")}
                  </div>
                )}
                {booking.actual_end_time && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-gray-500" />
                    Session End: {new Date(booking.actual_end_time).toLocaleString("en-GB")}
                  </div>
                )}
                {booking.completed_at && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
                    Completed: {new Date(booking.completed_at).toLocaleString("en-GB")}
                  </div>
                )}
                {booking.cancelled_at && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <AlertCircle className="h-3.5 w-3.5 text-danger-500" />
                    Cancelled: {new Date(booking.cancelled_at).toLocaleString("en-GB")}
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              {booking.admin_notes && (
                <>
                  <Divider className="my-4" />
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Admin Notes</p>
                    <p className="text-sm text-gray-300 bg-white/5 p-3 rounded-lg">
                      {booking.admin_notes}
                    </p>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* Delivery Photo */}
          {booking.delivery_photo_url && (
            <Card className="bg-surface-800 border border-white/10">
              <CardHeader className="flex items-center gap-2 px-6 pt-6">
                <Camera className="h-5 w-5 text-primary-500" />
                <h2 className="text-lg font-semibold text-white">Delivery Photo</h2>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <img
                  src={booking.delivery_photo_url}
                  alt="Delivery confirmation"
                  className="rounded-lg max-h-64 object-cover"
                />
                {booking.delivery_confirmed_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    Customer confirmed at{" "}
                    {new Date(booking.delivery_confirmed_at).toLocaleString("en-GB")}
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Audit Log Timeline */}
          <Card className="bg-surface-800 border border-white/10">
            <CardHeader className="flex items-center gap-2 px-6 pt-6">
              <ScrollText className="h-5 w-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-white">Activity Timeline</h2>
            </CardHeader>
            <CardBody className="px-6 pb-6">
              {auditLogs.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No activity logged yet</p>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log, index) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 bg-primary-500 rounded-full mt-1.5" />
                        {index < auditLogs.length - 1 && (
                          <div className="w-0.5 flex-1 bg-white/20 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm font-medium text-white">
                          {log.action.replace(/_/g, " ")}
                        </p>
                        {log.details && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {(log.details as any).from_status && (
                              <>
                                {String((log.details as any).from_status).replace(/_/g, " ")}{" "}
                                <ArrowRight className="h-3 w-3 inline" />{" "}
                                {String((log.details as any).to_status).replace(/_/g, " ")}
                              </>
                            )}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          by {log.actor_email} &middot;{" "}
                          {new Date(log.created_at).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {log.new_state && (log.new_state as any).admin_notes && (
                          <p className="text-xs text-gray-400 mt-1 bg-white/5 p-2 rounded">
                            Note: {String((log.new_state as any).admin_notes)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          {user && (
            <Card className="bg-surface-800 border border-white/10">
              <CardHeader className="flex items-center gap-2 px-6 pt-6">
                <UserIcon className="h-5 w-5 text-primary-500" />
                <h3 className="text-lg font-semibold text-white">Customer</h3>
              </CardHeader>
              <CardBody className="px-6 pb-6 space-y-3">
                <div>
                  <p className="font-medium">{user.full_name}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Phone className="h-4 w-4" />
                  {user.phone_number}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4" />
                  {user.hostel_name}, Room {user.room_number}
                </div>
                <Divider />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Bookings</span>
                  <span className="font-medium">{user.total_bookings}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Spent</span>
                  <span className="font-medium">{formatCurrency(user.total_amount_spent)}</span>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Payment Summary */}
          <Card className="bg-surface-800 border border-white/10">
            <CardHeader className="flex items-center gap-2 px-6 pt-6">
              <CreditCard className="h-5 w-5 text-primary-500" />
              <h3 className="text-lg font-semibold text-white">Payment Summary</h3>
            </CardHeader>
            <CardBody className="px-6 pb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Base ({booking.hours_booked}h x {formatCurrency(booking.hourly_rate)})
                </span>
                <span>{formatCurrency(booking.base_amount)}</span>
              </div>
              {booking.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-success-600">
                  <span>
                    Discount
                    {booking.promo_code_used && (
                      <Chip size="sm" variant="flat" className="ml-1">
                        {booking.promo_code_used}
                      </Chip>
                    )}
                  </span>
                  <span>-{formatCurrency(booking.discount_amount)}</span>
                </div>
              )}
              {booking.extension_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Extension ({booking.extension_hours}h)</span>
                  <span>{formatCurrency(booking.extension_amount)}</span>
                </div>
              )}
              <Divider />
              <div className="flex justify-between font-bold text-lg">
                <span className="text-white">Total</span>
                <span className="text-primary-400">{formatCurrency(booking.total_amount)}</span>
              </div>
            </CardBody>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader className="flex items-center gap-2 px-6 pt-6">
              <FileText className="h-5 w-5 text-primary-500" />
              <h3 className="text-lg font-semibold">Payments</h3>
            </CardHeader>
            <CardBody className="px-6 pb-6 space-y-3">
              {payments.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-2">No payments recorded</p>
              ) : (
                payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">
                        {payment.payment_type === "booking"
                          ? "Booking Payment"
                          : "Extension Payment"}
                      </p>
                      <StatusBadge status={payment.status} />
                    </div>
                    <p className="text-xs text-gray-400 font-mono">{payment.payment_id}</p>
                    <p className="font-semibold text-sm mt-1">{formatCurrency(payment.amount)}</p>
                    {payment.momo_number_from && (
                      <p className="text-xs text-gray-500 mt-1">
                        From: {payment.momo_number_from}
                      </p>
                    )}
                    {payment.momo_transaction_id && (
                      <p className="text-xs text-gray-500">
                        Txn: {payment.momo_transaction_id}
                      </p>
                    )}
                    {payment.verified_by && (
                      <p className="text-xs text-gray-400 mt-1">
                        Verified by {payment.verified_by}
                        {payment.verified_at &&
                          ` on ${new Date(payment.verified_at).toLocaleString("en-GB")}`}
                      </p>
                    )}
                    {payment.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">{payment.notes}</p>
                    )}
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Status Transition Modal */}
      <Modal isOpen={transitionModal.isOpen} onOpenChange={transitionModal.onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
              <ModalHeader>Confirm Status Change</ModalHeader>
              <ModalBody>
                <p className="text-sm text-gray-600 mb-4">
                  Change booking <strong>{booking.booking_id}</strong> from{" "}
                  <strong className="capitalize">{booking.status.replace(/_/g, " ")}</strong> to{" "}
                  <strong className="capitalize">{selectedTransition?.replace(/_/g, " ")}</strong>?
                </p>
                <input type="hidden" name="intent" value="update-status" />
                <input type="hidden" name="status" value={selectedTransition || ""} />
                <Textarea
                  label="Admin Notes (Optional)"
                  placeholder="Add any notes about this status change..."
                  value={transitionNotes}
                  onValueChange={setTransitionNotes}
                  name="admin_notes"
                  minRows={2}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color={
                    selectedTransition === "cancelled" || selectedTransition === "refunded"
                      ? "danger"
                      : "primary"
                  }
                  isLoading={isSubmitting}
                >
                  Confirm
                </Button>
              </ModalFooter>
            </Form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
