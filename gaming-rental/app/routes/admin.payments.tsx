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
  CreditCard,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Phone,
  Hash,
  PackageOpen,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

import { requireAdmin } from "~/services/session.server";
import { Payment, PaymentStatus, PaymentType } from "~/models/payment.server";
import { Booking, BookingStatus } from "~/models/booking.server";
import { Notification, NotificationType } from "~/models/notification.server";
import { AuditLog } from "~/models/audit-log.server";
import { formatCurrency } from "~/lib/constants";
import { generateNotificationId } from "~/lib/utils.server";
import { paymentVerifySchema } from "~/lib/validation";
import StatusBadge from "~/components/ui/status-badge";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "processing", label: "Processing" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
];

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "all";

  let query: Record<string, any> = {};
  if (statusFilter !== "all") {
    query.status = statusFilter;
  }

  // Sort: processing first, then by created_at descending
  const payments = await Payment.find(query)
    .sort({ status: 1, created_at: -1 })
    .lean();

  // Sort processing payments to the top
  const sortedPayments = [
    ...payments.filter((p) => p.status === PaymentStatus.PROCESSING),
    ...payments.filter((p) => p.status !== PaymentStatus.PROCESSING),
  ];

  return {
    payments: sortedPayments.map((p) => ({
      id: p._id.toString(),
      payment_id: p.payment_id,
      user_id: p.user_id,
      user_email: p.user_email,
      user_phone: p.user_phone,
      booking_id: p.booking_id,
      payment_type: p.payment_type,
      amount: p.amount,
      currency: p.currency,
      momo_number_to: p.momo_number_to,
      momo_name_to: p.momo_name_to,
      momo_number_from: p.momo_number_from,
      momo_transaction_id: p.momo_transaction_id,
      status: p.status,
      verified_by: p.verified_by,
      verified_at: p.verified_at?.toISOString() || null,
      notes: p.notes,
      created_at: p.created_at.toISOString(),
    })),
    statusFilter,
  };
}

export async function action({ request }: { request: Request }) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const paymentId = formData.get("payment_id") as string;

  const payment = await Payment.findOne({ payment_id: paymentId });
  if (!payment) {
    return data({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.status !== PaymentStatus.PROCESSING) {
    return data(
      { error: `Payment is already "${payment.status}" and cannot be modified` },
      { status: 400 }
    );
  }

  const notes = (formData.get("notes") as string) || "";

  if (intent === "verify") {
    const previousState = { status: payment.status };

    // Mark payment as completed
    payment.status = PaymentStatus.COMPLETED;
    payment.verified_by = admin.email;
    payment.verified_at = new Date();
    if (notes) payment.notes = notes;
    await payment.save();

    // Find the associated booking
    const booking = await Booking.findOne({ booking_id: payment.booking_id });

    if (booking) {
      if (payment.payment_type === PaymentType.BOOKING) {
        // Update booking status to payment_received
        const bookingPreviousState = { status: booking.status, is_paid: booking.is_paid };
        booking.status = BookingStatus.PAYMENT_RECEIVED;
        booking.is_paid = true;
        booking.payment_id = payment.payment_id;
        await booking.save();

        // Audit log for booking update
        await AuditLog.logAction({
          action: "booking_payment_verified",
          actor_id: admin._id.toString(),
          actor_email: admin.email,
          actor_role: admin.role,
          target_type: "booking",
          target_id: booking.booking_id,
          previous_state: bookingPreviousState,
          new_state: { status: BookingStatus.PAYMENT_RECEIVED, is_paid: true },
          details: { payment_id: payment.payment_id, amount: payment.amount },
        });

        // Notify user
        await Notification.create({
          notification_id: generateNotificationId(),
          user_id: booking.user_id,
          user_email: booking.user_email,
          notification_type: NotificationType.PAYMENT_RECEIVED,
          title: "Payment Verified",
          message: `Your payment of ${formatCurrency(payment.amount)} for booking ${booking.booking_id} has been verified.`,
          booking_id: booking.booking_id,
        });
      } else if (payment.payment_type === PaymentType.EXTENSION) {
        // Handle extension payment verification
        if (booking.pending_extension_hours > 0) {
          const prevState = {
            status: booking.status,
            extension_hours: booking.extension_hours,
            total_hours: booking.total_hours,
            end_time: booking.end_time.toISOString(),
          };

          const newEndTime = new Date(
            booking.end_time.getTime() + booking.pending_extension_hours * 60 * 60 * 1000
          );

          booking.extension_hours += booking.pending_extension_hours;
          booking.total_hours += booking.pending_extension_hours;
          booking.extension_amount += booking.pending_extension_amount;
          booking.total_amount += booking.pending_extension_amount;

          if (!booking.original_end_time) {
            booking.original_end_time = booking.end_time;
          }
          booking.end_time = newEndTime;

          booking.extension_payment_id = payment.payment_id;
          booking.status = BookingStatus.EXTENDED;

          // Clear pending extension fields
          booking.pending_extension_hours = 0;
          booking.pending_extension_amount = 0;
          booking.pending_extension_payment_id = "";

          await booking.save();

          // Audit log
          await AuditLog.logAction({
            action: "booking_extension_verified",
            actor_id: admin._id.toString(),
            actor_email: admin.email,
            actor_role: admin.role,
            target_type: "booking",
            target_id: booking.booking_id,
            previous_state: prevState,
            new_state: {
              status: BookingStatus.EXTENDED,
              extension_hours: booking.extension_hours,
              total_hours: booking.total_hours,
              end_time: newEndTime.toISOString(),
            },
            details: { payment_id: payment.payment_id, amount: payment.amount },
          });

          // Notify user
          await Notification.create({
            notification_id: generateNotificationId(),
            user_id: booking.user_id,
            user_email: booking.user_email,
            notification_type: NotificationType.SESSION_EXTENDED,
            title: "Session Extended",
            message: `Your session for booking ${booking.booking_id} has been extended. New end time: ${newEndTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`,
            booking_id: booking.booking_id,
          });
        }
      }
    }

    // Audit log for payment verification
    await AuditLog.logAction({
      action: "payment_verified",
      actor_id: admin._id.toString(),
      actor_email: admin.email,
      actor_role: admin.role,
      target_type: "payment",
      target_id: payment.payment_id,
      previous_state: previousState,
      new_state: { status: PaymentStatus.COMPLETED },
      details: {
        booking_id: payment.booking_id,
        amount: payment.amount,
        payment_type: payment.payment_type,
        notes,
      },
    });

    return { success: `Payment ${payment.payment_id} verified successfully` };
  }

  if (intent === "reject") {
    const previousState = { status: payment.status };

    // Mark payment as failed
    payment.status = PaymentStatus.FAILED;
    payment.verified_by = admin.email;
    payment.verified_at = new Date();
    if (notes) payment.notes = notes;
    await payment.save();

    // Find the associated booking and clean up pending extension if applicable
    const booking = await Booking.findOne({ booking_id: payment.booking_id });
    if (booking && payment.payment_type === PaymentType.EXTENSION) {
      if (booking.pending_extension_payment_id === payment.payment_id) {
        booking.pending_extension_hours = 0;
        booking.pending_extension_amount = 0;
        booking.pending_extension_payment_id = "";
        await booking.save();
      }
    }

    // Audit log
    await AuditLog.logAction({
      action: "payment_rejected",
      actor_id: admin._id.toString(),
      actor_email: admin.email,
      actor_role: admin.role,
      target_type: "payment",
      target_id: payment.payment_id,
      previous_state: previousState,
      new_state: { status: PaymentStatus.FAILED },
      details: {
        booking_id: payment.booking_id,
        amount: payment.amount,
        payment_type: payment.payment_type,
        notes,
      },
    });

    // Notify user
    if (booking) {
      await Notification.create({
        notification_id: generateNotificationId(),
        user_id: payment.user_id,
        user_email: payment.user_email,
        notification_type: NotificationType.BOOKING_CANCELLED,
        title: "Payment Rejected",
        message: `Your payment of ${formatCurrency(payment.amount)} for booking ${payment.booking_id} was not verified.${notes ? ` Reason: ${notes}` : ""} Please contact support or try again.`,
        booking_id: payment.booking_id,
      });
    }

    return { success: `Payment ${payment.payment_id} rejected` };
  }

  return data({ error: "Invalid action" }, { status: 400 });
}

export default function AdminPayments() {
  const { payments, statusFilter } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string; success?: string }>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const verifyModal = useDisclosure();
  const rejectModal = useDisclosure();
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  function handleFilterChange(key: string | number) {
    const newParams = new URLSearchParams(searchParams);
    if (key === "all") {
      newParams.delete("status");
    } else {
      newParams.set("status", String(key));
    }
    setSearchParams(newParams);
  }

  function openVerifyModal(paymentId: string) {
    setSelectedPayment(paymentId);
    setActionNotes("");
    verifyModal.onOpen();
  }

  function openRejectModal(paymentId: string) {
    setSelectedPayment(paymentId);
    setActionNotes("");
    rejectModal.onOpen();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="text-gray-500 mt-1">Verify and manage MoMo payments</p>
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
        aria-label="Payment status filter"
        selectedKey={statusFilter}
        onSelectionChange={handleFilterChange}
        variant="underlined"
        color="primary"
      >
        {STATUS_FILTERS.map((filter) => (
          <Tab key={filter.key} title={filter.label} />
        ))}
      </Tabs>

      {/* Payments Table */}
      <Card className="bg-surface-800 border border-white/10">
        <CardBody className="p-0">
          {payments.length === 0 ? (
            <div className="py-16 text-center">
              <PackageOpen className="h-16 w-16 mx-auto text-gray-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No payments found</h3>
              <p className="text-gray-400">
                {statusFilter === "all"
                  ? "No payments have been recorded yet."
                  : `No ${statusFilter} payments found.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left text-gray-400">
                    <th className="px-4 py-3 font-medium">Payment ID</th>
                    <th className="px-4 py-3 font-medium">Booking</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">MoMo Details</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className={`hover:bg-white/5 ${
                        payment.status === "processing" ? "bg-primary-500/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-400">
                          {payment.payment_id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/bookings/${payment.booking_id}`}
                          className="font-mono text-xs text-primary-400 hover:underline"
                        >
                          {payment.booking_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${
                            payment.payment_type === "booking"
                              ? "bg-primary-500/10 text-primary-400"
                              : "bg-accent-500/10 text-accent-400"
                          }`}
                        >
                          {payment.payment_type === "booking" ? "Booking" : "Extension"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-white">{payment.user_email}</p>
                          <p className="text-xs text-gray-400">{payment.user_phone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {payment.momo_number_from ? (
                          <div className="space-y-0.5">
                            <p className="text-xs flex items-center gap-1">
                              <Phone className="h-3 w-3 text-gray-400" />
                              {payment.momo_number_from}
                            </p>
                            {payment.momo_transaction_id && (
                              <p className="text-xs flex items-center gap-1">
                                <Hash className="h-3 w-3 text-gray-400" />
                                {payment.momo_transaction_id}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Not provided</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={payment.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(payment.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {payment.status === "processing" ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              color="success"
                              variant="flat"
                              onPress={() => openVerifyModal(payment.payment_id)}
                              startContent={<CheckCircle2 className="h-3 w-3" />}
                              className="text-xs"
                            >
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              color="danger"
                              variant="flat"
                              onPress={() => openRejectModal(payment.payment_id)}
                              startContent={<XCircle className="h-3 w-3" />}
                              className="text-xs"
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">
                            {payment.verified_by && (
                              <p>
                                {payment.status === "completed" ? "Verified" : "Rejected"} by{" "}
                                {payment.verified_by}
                              </p>
                            )}
                            {payment.notes && (
                              <p className="italic mt-0.5">{payment.notes}</p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Verify Modal */}
      <Modal isOpen={verifyModal.isOpen} onOpenChange={verifyModal.onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
              <ModalHeader className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success-500" />
                Verify Payment
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-gray-400 mb-4">
                  Confirm that payment <strong>{selectedPayment}</strong> has been received
                  via MTN MoMo. This will update the associated booking status.
                </p>
                <input type="hidden" name="intent" value="verify" />
                <input type="hidden" name="payment_id" value={selectedPayment || ""} />
                <Textarea
                  label="Notes (Optional)"
                  placeholder="Any verification notes..."
                  value={actionNotes}
                  onValueChange={setActionNotes}
                  name="notes"
                  minRows={2}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color="success"
                  isLoading={isSubmitting}
                  startContent={!isSubmitting ? <CheckCircle2 className="h-4 w-4" /> : undefined}
                >
                  Verify Payment
                </Button>
              </ModalFooter>
            </Form>
          )}
        </ModalContent>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={rejectModal.isOpen} onOpenChange={rejectModal.onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
              <ModalHeader className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-danger-500" />
                Reject Payment
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-gray-400 mb-4">
                  Reject payment <strong>{selectedPayment}</strong>. The user will be
                  notified that their payment was not verified.
                </p>
                <input type="hidden" name="intent" value="reject" />
                <input type="hidden" name="payment_id" value={selectedPayment || ""} />
                <Textarea
                  label="Reason for Rejection"
                  placeholder="e.g., Transaction ID not found, amount mismatch..."
                  value={actionNotes}
                  onValueChange={setActionNotes}
                  name="notes"
                  minRows={2}
                  isRequired
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color="danger"
                  isLoading={isSubmitting}
                  startContent={!isSubmitting ? <XCircle className="h-4 w-4" /> : undefined}
                >
                  Reject Payment
                </Button>
              </ModalFooter>
            </Form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
