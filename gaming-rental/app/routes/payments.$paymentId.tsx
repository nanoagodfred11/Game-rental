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
  Divider,
  Chip,
} from "@heroui/react";
import {
  CreditCard,
  Phone,
  Hash,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Info,
  Copy,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

import { requireUser } from "~/services/session.server";
import { Payment, PaymentStatus } from "~/models/payment.server";
import { Booking, BookingStatus } from "~/models/booking.server";
import { paymentConfirmSchema } from "~/lib/validation";
import { MOMO_NUMBER, MOMO_NAME, formatCurrency } from "~/lib/constants";
import StatusBadge from "~/components/ui/status-badge";
import { AnimatedPage } from "~/components/ui/animated-container";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { paymentId: string };
}) {
  const user = await requireUser(request);
  const payment = await Payment.findOne({
    payment_id: params.paymentId,
    user_id: user._id.toString(),
  }).lean();

  if (!payment) {
    throw data("Payment not found", { status: 404 });
  }

  const booking = await Booking.findOne({
    booking_id: payment.booking_id,
  }).lean();

  return {
    payment: {
      id: payment._id.toString(),
      payment_id: payment.payment_id,
      payment_type: payment.payment_type,
      booking_id: payment.booking_id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      momo_number_to: payment.momo_number_to,
      momo_name_to: payment.momo_name_to,
      momo_number_from: payment.momo_number_from || "",
      momo_transaction_id: payment.momo_transaction_id || "",
      created_at: payment.created_at.toISOString(),
    },
    booking: booking
      ? {
          booking_id: booking.booking_id,
          equipment_name: booking.equipment_name,
          hours_booked: booking.hours_booked,
          total_hours: booking.total_hours,
          status: booking.status,
        }
      : null,
    momoNumber: MOMO_NUMBER,
    momoName: MOMO_NAME,
  };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { paymentId: string };
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const formDataObj = Object.fromEntries(formData);

  const result = paymentConfirmSchema.safeParse(formDataObj);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors, error: null };
  }

  const { momo_number_from, momo_transaction_id } = result.data;

  const payment = await Payment.findOne({
    payment_id: params.paymentId,
    user_id: user._id.toString(),
  });

  if (!payment) {
    return { error: "Payment not found", errors: null };
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return { error: "Payment has already been submitted", errors: null };
  }

  // Update payment
  payment.momo_number_from = momo_number_from;
  payment.momo_transaction_id = momo_transaction_id;
  payment.status = PaymentStatus.PROCESSING;
  await payment.save();

  // Update booking status if it was pending
  const booking = await Booking.findOne({ booking_id: payment.booking_id });
  if (booking && booking.status === BookingStatus.PENDING) {
    booking.status = BookingStatus.PAYMENT_RECEIVED;
    await booking.save();
  }

  return redirect(`/bookings/${payment.booking_id}`);
}

export default function PaymentPage() {
  const { payment, booking, momoNumber, momoName } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [copied, setCopied] = useState("");

  const isPending = payment.status === "pending";
  const isProcessing = payment.status === "processing";
  const isCompleted = payment.status === "completed";

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      // Fallback - do nothing
    }
  }

  return (
    <AnimatedPage>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back Link */}
        {booking && (
          <Link
            to={`/bookings/${booking.booking_id}`}
            className="inline-flex items-center text-sm text-gray-400 hover:text-gray-200 mb-6"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Booking
          </Link>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Payment</h1>
            <p className="text-gray-400 font-mono text-sm mt-1">
              {payment.payment_id}
            </p>
          </div>
          <StatusBadge status={payment.status} />
        </div>

        {actionData?.error && (
          <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {actionData.error}
          </div>
        )}

        <div className="space-y-6">
          {/* Payment Amount */}
          <Card className="glass-card border border-white/10">
            <CardBody className="p-6 text-center">
              <p className="text-sm text-gray-400 mb-1">
                {payment.payment_type === "booking"
                  ? "Booking Payment"
                  : "Extension Payment"}
              </p>
              <p className="text-5xl font-extrabold neon-text-cyan mb-2" style={{ textShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
                {formatCurrency(payment.amount)}
              </p>
              {booking && (
                <p className="text-sm text-gray-400">
                  {booking.equipment_name} - {booking.total_hours} hours
                </p>
              )}
            </CardBody>
          </Card>

          {/* MoMo Payment Instructions */}
          {isPending && (
            <Card className="glass-card border border-white/10">
              <CardHeader className="flex items-center gap-2 px-6 pt-6">
                <Phone className="h-5 w-5 text-warning-500" />
                <h2 className="text-lg font-semibold text-white">
                  MTN Mobile Money Payment
                </h2>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Follow these steps to complete your payment:
                  </p>

                  <ol className="space-y-4">
                    <li className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-white">Dial *170#</p>
                        <p className="text-sm text-gray-400">
                          Open your MTN Mobile Money menu
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        2
                      </div>
                      <div>
                        <p className="font-medium text-white">Select "Send Money"</p>
                        <p className="text-sm text-gray-400">
                          Choose option 1 to send money
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-white">Send to this number:</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="bg-white/5 rounded-lg px-4 py-2 font-mono text-lg font-bold text-white">
                            {momoNumber}
                          </div>
                          <Button
                            size="sm"
                            variant="flat"
                            isIconOnly
                            onPress={() =>
                              copyToClipboard(momoNumber, "number")
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {copied === "number" && (
                            <span className="text-xs text-success-400">
                              Copied!
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          Name: <strong className="text-white">{momoName}</strong>
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        4
                      </div>
                      <div>
                        <p className="font-medium text-white">Enter the exact amount:</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="bg-primary-500/10 rounded-lg px-4 py-2 font-mono text-lg font-bold text-primary-300">
                            {payment.amount.toFixed(2)}
                          </div>
                          <Button
                            size="sm"
                            variant="flat"
                            isIconOnly
                            onPress={() =>
                              copyToClipboard(
                                payment.amount.toFixed(2),
                                "amount"
                              )
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {copied === "amount" && (
                            <span className="text-xs text-success-400">
                              Copied!
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        5
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          Enter your MoMo PIN to confirm
                        </p>
                        <p className="text-sm text-gray-400">
                          You will receive a confirmation SMS with a transaction
                          ID
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-success-500 to-success-400 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        6
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          Fill in the confirmation form below
                        </p>
                        <p className="text-sm text-gray-400">
                          Enter your phone number and the transaction ID from your
                          SMS
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Confirm Payment Form */}
          {isPending && (
            <Card className="glass-card border border-white/10">
              <CardHeader className="flex items-center gap-2 px-6 pt-6">
                <CheckCircle2 className="h-5 w-5 text-success-500" />
                <h2 className="text-lg font-semibold text-white">Confirm Payment</h2>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <Form method="post" className="space-y-4">
                  <Input
                    name="momo_number_from"
                    label="Your MoMo Phone Number"
                    placeholder="0XX XXX XXXX"
                    isRequired
                    startContent={<Phone className="h-4 w-4 text-gray-400" />}
                    isInvalid={!!actionData?.errors?.momo_number_from}
                    errorMessage={actionData?.errors?.momo_number_from?.[0]}
                    classNames={{
                      input: "text-white",
                      inputWrapper: "bg-white/5 border-white/10",
                    }}
                  />
                  <Input
                    name="momo_transaction_id"
                    label="Transaction ID"
                    placeholder="Enter the transaction ID from your SMS"
                    isRequired
                    startContent={<Hash className="h-4 w-4 text-gray-400" />}
                    isInvalid={!!actionData?.errors?.momo_transaction_id}
                    errorMessage={actionData?.errors?.momo_transaction_id?.[0]}
                    classNames={{
                      input: "text-white",
                      inputWrapper: "bg-white/5 border-white/10",
                    }}
                  />
                  <Button
                    type="submit"
                    color="primary"
                    size="lg"
                    fullWidth
                    isLoading={isSubmitting}
                    className="bg-primary-500 neon-glow-cyan"
                    startContent={
                      !isSubmitting ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : undefined
                    }
                  >
                    Confirm Payment
                  </Button>
                </Form>
              </CardBody>
            </Card>
          )}

          {/* Processing State */}
          {isProcessing && (
            <Card className="glass-card border border-white/10">
              <CardBody className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="h-8 w-8 text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Payment Being Verified
                </h3>
                <p className="text-gray-300 mb-4">
                  Your payment is being processed and verified by our team. This
                  usually takes a few minutes.
                </p>
                <div className="bg-white/5 rounded-lg p-4 text-sm text-left space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone Number</span>
                    <span className="font-mono text-gray-200">{payment.momo_number_from}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Transaction ID</span>
                    <span className="font-mono text-gray-200">
                      {payment.momo_transaction_id}
                    </span>
                  </div>
                </div>
                {booking && (
                  <Link to={`/bookings/${booking.booking_id}`}>
                    <Button
                      color="primary"
                      variant="flat"
                      className="mt-4"
                      endContent={<ArrowRight className="h-4 w-4" />}
                    >
                      View Booking
                    </Button>
                  </Link>
                )}
              </CardBody>
            </Card>
          )}

          {/* Completed State */}
          {isCompleted && (
            <Card className="glass-card border border-white/10 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
              <CardBody className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-success-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-success-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Payment Confirmed</h3>
                <p className="text-gray-300">
                  Your payment has been verified and confirmed.
                </p>
                {booking && (
                  <Link to={`/bookings/${booking.booking_id}`}>
                    <Button
                      color="primary"
                      className="mt-4"
                      endContent={<ArrowRight className="h-4 w-4" />}
                    >
                      View Booking
                    </Button>
                  </Link>
                )}
              </CardBody>
            </Card>
          )}

          {/* Important Notes */}
          <Card className="glass-card border border-white/10">
            <CardBody className="p-5">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-warning-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-400 space-y-2">
                  <p className="font-semibold text-white">Important Notes:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    <li>
                      Please send the <strong className="text-gray-400">exact amount</strong> shown above
                    </li>
                    <li>
                      Only send from a <strong className="text-gray-400">registered MTN MoMo number</strong>
                    </li>
                    <li>
                      Keep your transaction <strong className="text-gray-400">SMS confirmation</strong> until
                      your booking is complete
                    </li>
                    <li>
                      Payment verification usually takes{" "}
                      <strong className="text-gray-400">5-15 minutes</strong> during business hours
                    </li>
                    <li>
                      If you experience any issues, contact us with your booking
                      ID:{" "}
                      <span className="font-mono text-gray-400">
                        {payment.booking_id}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </AnimatedPage>
  );
}
