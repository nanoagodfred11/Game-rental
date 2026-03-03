import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { redirect, data } from "react-router";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Slider,
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
  Gamepad2,
  Calendar,
  Clock,
  MapPin,
  CreditCard,
  Timer,
  Plus,
  X,
  Camera,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

import { requireUser } from "~/services/session.server";
import { Booking, BookingStatus } from "~/models/booking.server";
import { Payment, PaymentType, PaymentStatus } from "~/models/payment.server";
import {
  generatePaymentId,
  calculateBookingAmount,
} from "~/lib/utils.server";
import {
  HOURLY_RATE,
  MAX_TOTAL_HOURS,
  MOMO_NUMBER,
  MOMO_NAME,
  formatCurrency,
} from "~/lib/constants";
import { bookingExtendSchema } from "~/lib/validation";
import StatusBadge from "~/components/ui/status-badge";
import { AnimatedPage } from "~/components/ui/animated-container";

// Status step definitions for the stepper
const STATUS_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "payment_received", label: "Payment Received" },
  { key: "confirmed", label: "Confirmed" },
  { key: "delivered", label: "Delivered" },
  { key: "in_use", label: "In Use" },
  { key: "completed", label: "Completed" },
];

const CANCELLABLE_STATUSES = [
  "pending",
  "payment_received",
  "confirmed",
];

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { bookingId: string };
}) {
  const user = await requireUser(request);
  const booking = await Booking.findOne({
    booking_id: params.bookingId,
    user_id: user._id.toString(),
  }).lean();

  if (!booking) {
    throw data("Booking not found", { status: 404 });
  }

  // Get associated payments
  const payments = await Payment.find({
    booking_id: booking.booking_id,
  })
    .sort({ created_at: -1 })
    .lean();

  return {
    booking: {
      id: booking._id.toString(),
      booking_id: booking.booking_id,
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
      pending_extension_hours: booking.pending_extension_hours,
      pending_extension_amount: booking.pending_extension_amount,
      pending_extension_payment_id: booking.pending_extension_payment_id,
      created_at: booking.created_at.toISOString(),
      admin_notes: booking.admin_notes,
    },
    payments: payments.map((p) => ({
      id: p._id.toString(),
      payment_id: p.payment_id,
      payment_type: p.payment_type,
      amount: p.amount,
      status: p.status,
      created_at: p.created_at.toISOString(),
    })),
    maxTotalHours: MAX_TOTAL_HOURS,
  };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { bookingId: string };
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const booking = await Booking.findOne({
    booking_id: params.bookingId,
    user_id: user._id.toString(),
  });

  if (!booking) {
    return { error: "Booking not found" };
  }

  if (intent === "extend") {
    // Validate extension
    if (
      booking.status !== BookingStatus.IN_USE &&
      booking.status !== BookingStatus.EXTENDED
    ) {
      return { error: "Can only extend active sessions" };
    }

    const result = bookingExtendSchema.safeParse(
      Object.fromEntries(formData)
    );
    if (!result.success) {
      return {
        error: result.error.flatten().fieldErrors.additional_hours?.[0] ||
          "Invalid extension hours",
      };
    }

    const { additional_hours } = result.data;
    const newTotalHours = booking.total_hours + additional_hours;

    if (newTotalHours > MAX_TOTAL_HOURS) {
      return {
        error: `Cannot exceed ${MAX_TOTAL_HOURS} total hours. You have ${booking.total_hours} hours currently.`,
      };
    }

    // Check for conflicts with the extended time
    const newEndTime = new Date(
      booking.end_time.getTime() + additional_hours * 60 * 60 * 1000
    );

    const conflicting = await Booking.findOne({
      equipment_id: booking.equipment_id,
      _id: { $ne: booking._id },
      status: {
        $nin: [
          BookingStatus.CANCELLED,
          BookingStatus.REFUNDED,
          BookingStatus.COMPLETED,
        ],
      },
      start_time: { $lt: newEndTime },
      end_time: { $gt: booking.end_time },
    });

    if (conflicting) {
      return {
        error: "Cannot extend - another booking conflicts with the extended time",
      };
    }

    const extensionAmount = calculateBookingAmount(
      additional_hours,
      booking.hourly_rate
    );
    const extensionPaymentId = generatePaymentId();

    // Create extension payment
    await Payment.create({
      payment_id: extensionPaymentId,
      user_id: user._id.toString(),
      user_email: user.email,
      user_phone: user.phone_number,
      booking_id: booking.booking_id,
      payment_type: PaymentType.EXTENSION,
      amount: extensionAmount,
      momo_number_to: MOMO_NUMBER,
      momo_name_to: MOMO_NAME,
      status: PaymentStatus.PENDING,
    });

    // Update booking with pending extension
    booking.pending_extension_hours = additional_hours;
    booking.pending_extension_amount = extensionAmount;
    booking.pending_extension_payment_id = extensionPaymentId;
    await booking.save();

    return redirect(`/payments/${extensionPaymentId}`);
  }

  if (intent === "cancel") {
    if (
      !CANCELLABLE_STATUSES.includes(booking.status as BookingStatus)
    ) {
      return { error: "This booking cannot be cancelled at its current status" };
    }

    booking.status = BookingStatus.CANCELLED;
    booking.cancelled_at = new Date();
    await booking.save();

    // Free up equipment
    const { Equipment } = await import("~/models/equipment.server");
    await Equipment.updateOne(
      { equipment_id: booking.equipment_id, current_booking_id: booking.booking_id },
      { status: "available", current_booking_id: null }
    );

    return { success: "Booking cancelled successfully" };
  }

  if (intent === "confirm-delivery") {
    if (booking.status !== BookingStatus.DELIVERED) {
      return { error: "Delivery confirmation is only available for delivered bookings" };
    }

    const photoData = formData.get("delivery_photo");
    if (photoData && typeof photoData === "string" && photoData.length > 0) {
      booking.delivery_photo_url = photoData;
    }

    booking.status = BookingStatus.AWAITING_CONFIRMATION;
    booking.delivery_confirmed_at = new Date();
    await booking.save();

    return { success: "Delivery confirmed! Your session will begin shortly." };
  }

  return { error: "Invalid action" };
}

function LiveTimer({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [progress, setProgress] = useState(1);
  const [totalDuration, setTotalDuration] = useState(0);

  const calculateTimeLeft = useCallback(() => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) {
      setTimeLeft("00:00:00");
      setIsExpired(true);
      setProgress(0);
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeLeft(
      `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    );
    setIsExpired(false);

    if (totalDuration > 0) {
      setProgress(Math.min(diff / totalDuration, 1));
    }
  }, [endTime, totalDuration]);

  useEffect(() => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;
    // Estimate total duration as remaining time on first render (best guess)
    if (diff > 0 && totalDuration === 0) {
      setTotalDuration(diff);
    }
  }, [endTime, totalDuration]);

  useEffect(() => {
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [calculateTimeLeft]);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const getStrokeColor = () => {
    if (isExpired) return "#ef4444";
    if (progress > 0.5) return "#22c55e";
    if (progress > 0.15) return "#f59e0b";
    return "#ef4444";
  };

  const isCritical = !isExpired && progress <= 0.15;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`glass-card p-8 ${isCritical ? "animate-pulse-glow" : ""} ${isExpired ? "shadow-[0_0_30px_rgba(239,68,68,0.3)]" : ""}`}
    >
      <div className="hud-corners">
        <div className="flex flex-col items-center">
          {/* Session status label */}
          <div className="flex items-center gap-2 mb-4">
            {isExpired ? (
              <>
                <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-widest text-danger-400">
                  Session Ended
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-widest text-success-400">
                  Session Active
                </span>
              </>
            )}
          </div>

          {/* SVG Circular Progress Ring */}
          <div className="relative">
            <svg viewBox="0 0 200 200" className="w-56 h-56">
              {/* Background circle */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="6"
              />
              {/* Progress circle */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={getStrokeColor()}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 100 100)"
                className="transition-all duration-1000"
                style={{
                  filter: `drop-shadow(0 0 6px ${getStrokeColor()}40)`,
                }}
              />
              {/* Time display at center */}
              <text
                x="100"
                y="105"
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-mono"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: timeLeft.length > 7 ? "24px" : "28px",
                  fontWeight: 700,
                  fill: isExpired ? "#ef4444" : "white",
                }}
              >
                {timeLeft}
              </text>
            </svg>
          </div>

          {/* Until time */}
          {!isExpired && (
            <p className="text-sm text-gray-400 mt-2 font-mono">
              Until{" "}
              {new Date(endTime).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function BookingStepper({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus);
  const isCancelled = currentStatus === "cancelled" || currentStatus === "refunded";

  if (isCancelled) {
    return (
      <div className="flex items-center justify-center py-4">
        <Chip color="danger" size="lg" variant="flat">
          {currentStatus === "cancelled" ? "Booking Cancelled" : "Booking Refunded"}
        </Chip>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center min-w-[600px] px-2 py-4">
        {STATUS_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCompleted
                      ? "bg-success-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                      : isCurrent
                        ? "bg-primary-500 text-white ring-4 ring-primary-500/20 shadow-[0_0_10px_rgba(6,182,212,0.3)] animate-pulse-glow"
                        : "bg-white/5 border border-white/20 text-gray-500"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`text-xs mt-1.5 text-center whitespace-nowrap ${
                    isCurrent
                      ? "font-semibold text-primary-400"
                      : isCompleted
                        ? "text-success-400"
                        : "text-gray-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STATUS_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-18px] ${
                    isCompleted ? "bg-gradient-to-r from-success-500 to-success-500/50" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BookingDetail() {
  const { booking, payments, maxTotalHours } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const cancelModal = useDisclosure();
  const [extensionHours, setExtensionHours] = useState(1);
  const [photoBase64, setPhotoBase64] = useState("");

  const canExtend =
    (booking.status === "in_use" || booking.status === "extended") &&
    booking.total_hours < maxTotalHours;
  const maxExtension = maxTotalHours - booking.total_hours;

  const canCancel = ["pending", "payment_received", "confirmed"].includes(
    booking.status
  );
  const isActive = booking.status === "in_use" || booking.status === "extended";
  const isDelivered = booking.status === "delivered";

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <AnimatedPage>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          to="/bookings"
          className="inline-flex items-center text-sm text-gray-400 hover:text-gray-200 mb-6"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Bookings
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">{booking.equipment_name}</h1>
            <p className="text-gray-500 font-mono text-sm mt-1">
              {booking.booking_id}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Feedback Messages */}
        {actionData?.error && (
          <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {actionData.error}
          </div>
        )}
        {actionData?.success && (
          <div className="bg-success-500/10 border border-success-500/20 text-success-400 p-4 rounded-lg mb-6 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            {actionData.success}
          </div>
        )}

        {/* Status Stepper */}
        <Card className="mb-6 glass-card border border-white/10">
          <CardBody className="py-2 px-4">
            <BookingStepper currentStatus={booking.status} />
          </CardBody>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Live Timer */}
            {isActive && <LiveTimer endTime={booking.end_time} />}

            {/* Booking Details */}
            <Card className="glass-card border border-white/10">
              <CardHeader className="flex items-center gap-2 px-6 pt-6">
                <Gamepad2 className="h-5 w-5 text-primary-500" />
                <h2 className="text-lg font-semibold text-white">Booking Details</h2>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Equipment
                      </p>
                      <p className="font-medium text-gray-200">
                        {booking.equipment_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {booking.equipment_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Date
                      </p>
                      <p className="font-medium text-gray-200 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        {new Date(booking.booking_date).toLocaleDateString(
                          "en-GB",
                          {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Time Slot
                      </p>
                      <p className="font-medium text-gray-200 flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-gray-500" />
                        {new Date(booking.start_time).toLocaleTimeString(
                          "en-GB",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}{" "}
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
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Delivery Location
                      </p>
                      <p className="font-medium text-gray-200 flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        {booking.hostel_name}, Room {booking.room_number}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Duration
                      </p>
                      <p className="font-medium text-gray-200">
                        {booking.total_hours} hours
                        {booking.extension_hours > 0 && (
                          <span className="text-sm text-gray-400 ml-1">
                            ({booking.hours_booked}h + {booking.extension_hours}h
                            ext.)
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Booked On
                      </p>
                      <p className="font-medium text-gray-200">
                        {new Date(booking.created_at).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Extend Session Form */}
            {canExtend && (
              <Card className="glass-card border border-white/10">
                <CardHeader className="flex items-center gap-2 px-6 pt-6">
                  <Plus className="h-5 w-5 text-primary-500" />
                  <h2 className="text-lg font-semibold text-white">Extend Session</h2>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                  {booking.pending_extension_hours > 0 ? (
                    <div className="bg-warning-500/10 border border-warning-500/20 p-4 rounded-lg">
                      <p className="text-warning-400 font-medium">
                        Extension Pending Payment
                      </p>
                      <p className="text-sm text-warning-400 mt-1">
                        You have a pending extension of{" "}
                        {booking.pending_extension_hours} hour(s) for{" "}
                        {formatCurrency(booking.pending_extension_amount)}.
                      </p>
                      <Link
                        to={`/payments/${booking.pending_extension_payment_id}`}
                      >
                        <Button
                          size="sm"
                          color="warning"
                          variant="flat"
                          className="mt-2"
                          endContent={<ArrowRight className="h-4 w-4" />}
                        >
                          Complete Payment
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <Form method="post">
                      <input type="hidden" name="intent" value="extend" />
                      <div className="space-y-4">
                        <p className="text-sm text-gray-400">
                          You can extend your session by up to {maxExtension} more
                          hour(s). Current total: {booking.total_hours}h /{" "}
                          {maxTotalHours}h max.
                        </p>
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-3">
                            Additional Hours: {extensionHours}
                          </label>
                          <Slider
                            aria-label="Extension hours"
                            step={1}
                            minValue={1}
                            maxValue={Math.min(maxExtension, 4)}
                            value={extensionHours}
                            onChange={(val) =>
                              setExtensionHours(
                                typeof val === "number" ? val : val[0]
                              )
                            }
                            showSteps
                            className="max-w-full"
                          />
                          <input
                            type="hidden"
                            name="additional_hours"
                            value={extensionHours}
                          />
                        </div>
                        <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                          <span className="text-sm text-gray-300">
                            Extension Cost
                          </span>
                          <span className="font-bold neon-text-cyan">
                            {formatCurrency(
                              extensionHours * booking.hourly_rate
                            )}
                          </span>
                        </div>
                        <Button
                          type="submit"
                          color="primary"
                          fullWidth
                          isLoading={isSubmitting}
                        >
                          Extend & Pay
                        </Button>
                      </div>
                    </Form>
                  )}
                </CardBody>
              </Card>
            )}

            {/* Delivery Confirmation */}
            {isDelivered && (
              <Card className="glass-card border border-white/10">
                <CardHeader className="flex items-center gap-2 px-6 pt-6">
                  <Camera className="h-5 w-5 text-primary-500" />
                  <h2 className="text-lg font-semibold text-white">Confirm Delivery</h2>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                  <Form method="post">
                    <input type="hidden" name="intent" value="confirm-delivery" />
                    <div className="space-y-4">
                      <p className="text-sm text-gray-400">
                        Your equipment has been delivered! Please take a photo of
                        the setup to confirm receipt.
                      </p>
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Setup Photo (Optional)
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoChange}
                          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-500/10 file:text-primary-400 hover:file:bg-primary-500/20"
                        />
                        <input
                          type="hidden"
                          name="delivery_photo"
                          value={photoBase64}
                        />
                      </div>
                      {photoBase64 && (
                        <div className="relative">
                          <img
                            src={photoBase64}
                            alt="Delivery photo preview"
                            className="rounded-lg max-h-48 object-cover"
                          />
                        </div>
                      )}
                      <Button
                        type="submit"
                        color="success"
                        fullWidth
                        isLoading={isSubmitting}
                        startContent={
                          !isSubmitting ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : undefined
                        }
                      >
                        Confirm Delivery
                      </Button>
                    </div>
                  </Form>
                </CardBody>
              </Card>
            )}

            {/* Delivery Photo Display */}
            {booking.delivery_photo_url && (
              <Card className="glass-card border border-white/10">
                <CardHeader className="px-6 pt-6">
                  <h3 className="text-lg font-semibold text-white">Delivery Photo</h3>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                  <img
                    src={booking.delivery_photo_url}
                    alt="Delivery confirmation"
                    className="rounded-lg max-h-64 object-cover"
                  />
                  {booking.delivery_confirmed_at && (
                    <p className="text-xs text-gray-400 mt-2">
                      Confirmed at{" "}
                      {new Date(booking.delivery_confirmed_at).toLocaleString("en-GB")}
                    </p>
                  )}
                </CardBody>
              </Card>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Payment Summary */}
            <Card className="glass-card border border-white/10">
              <CardHeader className="flex items-center gap-2 px-6 pt-6">
                <CreditCard className="h-5 w-5 text-primary-500" />
                <h3 className="text-lg font-semibold text-white">Payment Summary</h3>
              </CardHeader>
              <CardBody className="px-6 pb-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Base ({booking.hours_booked}h x{" "}
                    {formatCurrency(booking.hourly_rate)})
                  </span>
                  <span className="text-gray-200">{formatCurrency(booking.base_amount)}</span>
                </div>
                {booking.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-success-400">
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
                    <span className="text-gray-500">
                      Extension ({booking.extension_hours}h)
                    </span>
                    <span className="text-gray-200">{formatCurrency(booking.extension_amount)}</span>
                  </div>
                )}
                <Divider />
                <div className="flex justify-between font-bold text-lg">
                  <span className="text-white">Total</span>
                  <span className="neon-text-cyan">
                    {formatCurrency(booking.total_amount)}
                  </span>
                </div>
              </CardBody>
            </Card>

            {/* Payment History */}
            <Card className="glass-card border border-white/10">
              <CardHeader className="px-6 pt-6">
                <h3 className="text-lg font-semibold text-white">Payments</h3>
              </CardHeader>
              <CardBody className="px-6 pb-6 space-y-3">
                {payments.map((payment) => (
                  <Link
                    key={payment.id}
                    to={`/payments/${payment.payment_id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {payment.payment_type === "booking"
                            ? "Booking Payment"
                            : "Extension Payment"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {payment.payment_id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-gray-200">
                          {formatCurrency(payment.amount)}
                        </p>
                        <StatusBadge status={payment.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </CardBody>
            </Card>

            {/* Cancel Booking */}
            {canCancel && (
              <Button
                color="danger"
                variant="flat"
                fullWidth
                startContent={<X className="h-4 w-4" />}
                onPress={cancelModal.onOpen}
              >
                Cancel Booking
              </Button>
            )}
          </div>
        </div>

        {/* Cancel Confirmation Modal */}
        <Modal isOpen={cancelModal.isOpen} onOpenChange={cancelModal.onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>Cancel Booking?</ModalHeader>
                <ModalBody>
                  <p>
                    Are you sure you want to cancel booking{" "}
                    <strong>{booking.booking_id}</strong>? This action cannot be
                    undone.
                  </p>
                  {booking.is_paid && (
                    <p className="text-sm text-warning-400 mt-2">
                      Note: If you have already made a payment, a refund will need
                      to be processed by the admin.
                    </p>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>
                    Keep Booking
                  </Button>
                  <Form method="post">
                    <input type="hidden" name="intent" value="cancel" />
                    <Button
                      type="submit"
                      color="danger"
                      isLoading={isSubmitting}
                    >
                      Yes, Cancel
                    </Button>
                  </Form>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    </AnimatedPage>
  );
}
