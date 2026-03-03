import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { data } from "react-router";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Tabs,
  Tab,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import {
  CalendarDays,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  User as UserIcon,
  ArrowRight,
  PackageOpen,
} from "lucide-react";
import { useState } from "react";

import { requireAdmin } from "~/services/session.server";
import { Booking, BookingStatus } from "~/models/booking.server";
import { Equipment } from "~/models/equipment.server";
import { User } from "~/models/user.server";
import { Notification, NotificationType } from "~/models/notification.server";
import { AuditLog } from "~/models/audit-log.server";
import { VALID_TRANSITIONS, formatCurrency } from "~/lib/constants";
import { generateNotificationId } from "~/lib/utils.server";
import { bookingStatusUpdateSchema } from "~/lib/validation";
import StatusBadge from "~/components/ui/status-badge";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "payment_received", label: "Payment Received" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in_use", label: "In Use" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const ACTIVE_STATUSES = [
  "payment_received",
  "confirmed",
  "delivered",
  "awaiting_confirmation",
  "in_use",
  "extended",
];

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "all";

  let query: Record<string, any> = {};

  if (statusFilter === "active") {
    query.status = { $in: ACTIVE_STATUSES };
  } else if (statusFilter === "all") {
    // no filter
  } else if (statusFilter === "cancelled") {
    query.status = { $in: ["cancelled", "refunded"] };
  } else {
    query.status = statusFilter;
  }

  const bookings = await Booking.find(query)
    .sort({ created_at: -1 })
    .lean();

  return {
    bookings: bookings.map((b) => ({
      id: b._id.toString(),
      booking_id: b.booking_id,
      user_email: b.user_email,
      user_phone: b.user_phone,
      equipment_name: b.equipment_name,
      equipment_id: b.equipment_id,
      hostel_name: b.hostel_name,
      room_number: b.room_number,
      booking_date: b.booking_date.toISOString(),
      start_time: b.start_time.toISOString(),
      end_time: b.end_time.toISOString(),
      hours_booked: b.hours_booked,
      total_hours: b.total_hours,
      total_amount: b.total_amount,
      status: b.status,
      is_paid: b.is_paid,
      created_at: b.created_at.toISOString(),
    })),
    statusFilter,
    validTransitions: VALID_TRANSITIONS,
  };
}

export async function action({ request }: { request: Request }) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-status") {
    const bookingId = formData.get("booking_id") as string;
    const result = bookingStatusUpdateSchema.safeParse(Object.fromEntries(formData));

    if (!result.success) {
      return data(
        { error: result.error.flatten().fieldErrors.status?.[0] || "Invalid status" },
        { status: 400 }
      );
    }

    const { status: newStatus, admin_notes } = result.data;

    const booking = await Booking.findOne({ booking_id: bookingId });
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

    // Handle side effects based on status transition
    if (newStatus === BookingStatus.CONFIRMED) {
      booking.confirmed_at = new Date();
    }

    if (newStatus === BookingStatus.DELIVERED) {
      booking.delivered_at = new Date();
      // Update equipment to delivered
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id },
        { status: "delivered", current_booking_id: booking.booking_id }
      );
    }

    if (newStatus === BookingStatus.IN_USE) {
      booking.actual_start_time = new Date();
      // Update equipment to in_use
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id },
        { status: "in_use", current_booking_id: booking.booking_id }
      );
    }

    if (newStatus === BookingStatus.COMPLETED) {
      booking.completed_at = new Date();
      booking.actual_end_time = new Date();
      // Free equipment
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
      // Update user stats
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
      // Free equipment
      await Equipment.updateOne(
        { equipment_id: booking.equipment_id, current_booking_id: booking.booking_id },
        { status: "available", current_booking_id: null }
      );
    }

    if (newStatus === BookingStatus.REFUNDED) {
      // Free equipment
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

    // Notify user about status change
    const notificationMap: Record<string, { type: NotificationType; title: string; message: string }> = {
      [BookingStatus.PAYMENT_RECEIVED]: {
        type: NotificationType.PAYMENT_RECEIVED,
        title: "Payment Received",
        message: `Your payment for booking ${booking.booking_id} has been received.`,
      },
      [BookingStatus.CONFIRMED]: {
        type: NotificationType.BOOKING_CONFIRMED,
        title: "Booking Confirmed",
        message: `Your booking ${booking.booking_id} has been confirmed. Equipment will be delivered to your location.`,
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

    return { success: `Booking ${booking.booking_id} updated to "${newStatus}"` };
  }

  return data({ error: "Invalid action" }, { status: 400 });
}

export default function AdminBookings() {
  const { bookings, statusFilter, validTransitions } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string; success?: string }>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const transitionModal = useDisclosure();
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null);
  const [transitionNotes, setTransitionNotes] = useState("");

  function handleFilterChange(key: string | number) {
    const newParams = new URLSearchParams(searchParams);
    if (key === "all") {
      newParams.delete("status");
    } else {
      newParams.set("status", String(key));
    }
    setSearchParams(newParams);
  }

  function openTransitionModal(bookingId: string, newStatus: string) {
    setSelectedBooking(bookingId);
    setSelectedTransition(newStatus);
    setTransitionNotes("");
    transitionModal.onOpen();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Bookings</h1>
        <p className="text-gray-500 mt-1">Manage all customer bookings</p>
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

      {/* Status Filter Tabs */}
      <Tabs
        aria-label="Booking status filter"
        selectedKey={statusFilter}
        onSelectionChange={handleFilterChange}
        variant="underlined"
        color="primary"
      >
        {STATUS_FILTERS.map((filter) => (
          <Tab key={filter.key} title={filter.label} />
        ))}
      </Tabs>

      {/* Bookings Table */}
      <Card className="bg-surface-800 border border-white/10">
        <CardBody className="p-0">
          {bookings.length === 0 ? (
            <div className="py-16 text-center">
              <PackageOpen className="h-16 w-16 mx-auto text-gray-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No bookings found</h3>
              <p className="text-gray-400">
                {statusFilter === "all"
                  ? "No bookings have been made yet."
                  : `No ${statusFilter} bookings found.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left text-gray-400">
                    <th className="px-4 py-3 font-medium">Booking ID</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Equipment</th>
                    <th className="px-4 py-3 font-medium">Schedule</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {bookings.map((booking) => {
                    const transitions = validTransitions[booking.status] || [];
                    return (
                      <tr key={booking.id} className="hover:bg-white/5">
                        <td className="px-4 py-3">
                          <Link
                            to={`/admin/bookings/${booking.booking_id}`}
                            className="font-mono text-xs text-primary-400 hover:underline"
                          >
                            {booking.booking_id}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white text-sm">{booking.user_email}</p>
                            <p className="text-gray-400 text-xs">{booking.user_phone}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{booking.equipment_name}</p>
                          <p className="text-gray-400 text-xs">{booking.equipment_id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm">
                            {new Date(booking.booking_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(booking.start_time).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" - "}
                            {new Date(booking.end_time).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" "}({booking.total_hours}h)
                          </p>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {formatCurrency(booking.total_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={booking.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {transitions.map((t) => (
                              <Button
                                key={t}
                                size="sm"
                                variant="flat"
                                color={
                                  t === "cancelled" || t === "refunded"
                                    ? "danger"
                                    : t === "completed"
                                      ? "success"
                                      : "primary"
                                }
                                onPress={() => openTransitionModal(booking.booking_id, t)}
                                className="text-xs"
                              >
                                {t.replace(/_/g, " ")}
                              </Button>
                            ))}
                            <Link to={`/admin/bookings/${booking.booking_id}`}>
                              <Button size="sm" variant="light" isIconOnly>
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Status Transition Modal */}
      <Modal isOpen={transitionModal.isOpen} onOpenChange={transitionModal.onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
              <ModalHeader>
                Confirm Status Change
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-gray-400 mb-4">
                  Change booking <strong>{selectedBooking}</strong> status to{" "}
                  <strong className="capitalize">{selectedTransition?.replace(/_/g, " ")}</strong>?
                </p>
                <input type="hidden" name="intent" value="update-status" />
                <input type="hidden" name="booking_id" value={selectedBooking || ""} />
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
