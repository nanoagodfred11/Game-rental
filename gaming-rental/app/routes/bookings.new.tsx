import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { redirect } from "react-router";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Slider,
  Chip,
  Divider,
} from "@heroui/react";
import {
  Gamepad2,
  Calendar,
  Clock,
  Tag,
  CreditCard,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState, useMemo } from "react";

import { requireUser } from "~/services/session.server";
import { Equipment } from "~/models/equipment.server";
import { Booking, BookingStatus } from "~/models/booking.server";
import { Payment, PaymentType, PaymentStatus } from "~/models/payment.server";
import { PromoCode, DiscountType } from "~/models/promo-code.server";
import { bookingCreateSchema } from "~/lib/validation";
import {
  generateBookingId,
  generatePaymentId,
  calculateBookingAmount,
} from "~/lib/utils.server";
import {
  HOURLY_RATE,
  MIN_BOOKING_HOURS,
  MAX_BOOKING_HOURS,
  MOMO_NUMBER,
  MOMO_NAME,
  formatCurrency,
} from "~/lib/constants";
import { AnimatedPage } from "~/components/ui/animated-container";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const preselectedEquipment = url.searchParams.get("equipment") || "";

  const equipment = await Equipment.find().lean();

  return {
    equipment: equipment.map((e) => ({
      id: e._id.toString(),
      equipment_id: e.equipment_id,
      name: e.name,
      description: e.description,
      status: e.status,
      hourly_rate: e.hourly_rate,
      components: e.components,
    })),
    preselectedEquipment,
    hourlyRate: HOURLY_RATE,
    minHours: MIN_BOOKING_HOURS,
    maxHours: MAX_BOOKING_HOURS,
  };
}

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  const result = bookingCreateSchema.safeParse(data);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors, error: null };
  }

  const { equipment_id, booking_date, start_time, hours, promo_code } =
    result.data;

  // Find the equipment
  const equipment = await Equipment.findOne({ equipment_id });
  if (!equipment) {
    return { error: "Equipment not found", errors: null };
  }
  if (equipment.status !== "available") {
    return { error: "This equipment is not currently available", errors: null };
  }

  // Parse booking_date + start_time into Date objects
  const startDateTime = new Date(`${booking_date}T${start_time}:00`);
  if (isNaN(startDateTime.getTime())) {
    return { error: "Invalid date or time", errors: null };
  }

  // Ensure booking is in the future
  if (startDateTime <= new Date()) {
    return { error: "Booking must be in the future", errors: null };
  }

  // Validate hours
  if (hours < MIN_BOOKING_HOURS || hours > MAX_BOOKING_HOURS) {
    return {
      error: `Hours must be between ${MIN_BOOKING_HOURS} and ${MAX_BOOKING_HOURS}`,
      errors: null,
    };
  }

  const endDateTime = new Date(
    startDateTime.getTime() + hours * 60 * 60 * 1000
  );
  const bookingDate = new Date(booking_date);

  // Check for overlapping bookings on the same equipment
  const conflicting = await Booking.findOne({
    equipment_id: equipment.equipment_id,
    status: {
      $nin: [
        BookingStatus.CANCELLED,
        BookingStatus.REFUNDED,
        BookingStatus.COMPLETED,
      ],
    },
    start_time: { $lt: endDateTime },
    end_time: { $gt: startDateTime },
  });

  if (conflicting) {
    return {
      error:
        "This equipment is already booked for the selected time. Please choose a different time or equipment.",
      errors: null,
    };
  }

  // Calculate pricing
  const hourlyRate = equipment.hourly_rate || HOURLY_RATE;
  let baseAmount = calculateBookingAmount(hours, hourlyRate);
  let discountAmount = 0;
  let promoCodeUsed = "";

  // Validate promo code if provided
  if (promo_code && promo_code.trim()) {
    const promo = await PromoCode.findOne({
      code: promo_code.toUpperCase().trim(),
      is_active: true,
    });

    if (!promo) {
      return { error: "Invalid or inactive promo code", errors: null };
    }

    // Check validity period
    const now = new Date();
    if (promo.valid_from && now < promo.valid_from) {
      return { error: "Promo code is not yet valid", errors: null };
    }
    if (promo.valid_until && now > promo.valid_until) {
      return { error: "Promo code has expired", errors: null };
    }

    // Check usage limits
    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      return { error: "Promo code usage limit reached", errors: null };
    }

    // Check per-user limit
    const userUsageCount = promo.used_by.filter(
      (id: string) => id === user._id.toString()
    ).length;
    if (userUsageCount >= promo.max_uses_per_user) {
      return {
        error: "You have already used this promo code the maximum number of times",
        errors: null,
      };
    }

    // Check allowed emails
    if (
      promo.allowed_emails.length > 0 &&
      !promo.allowed_emails.includes(user.email)
    ) {
      return {
        error: "This promo code is not available for your account",
        errors: null,
      };
    }

    // Check first booking only
    if (promo.first_booking_only && user.total_bookings > 0) {
      return {
        error: "This promo code is only valid for first-time bookings",
        errors: null,
      };
    }

    // Check minimum hours
    if (hours < promo.min_hours) {
      return {
        error: `This promo code requires a minimum of ${promo.min_hours} hours`,
        errors: null,
      };
    }

    // Calculate discount
    if (promo.discount_type === DiscountType.PERCENTAGE) {
      discountAmount = Math.round(baseAmount * (promo.discount_value / 100));
      if (promo.max_discount) {
        discountAmount = Math.min(discountAmount, promo.max_discount);
      }
    } else if (promo.discount_type === DiscountType.FIXED) {
      discountAmount = promo.discount_value;
    } else if (promo.discount_type === DiscountType.FREE_HOURS) {
      discountAmount = Math.round(promo.discount_value * hourlyRate);
    }

    discountAmount = Math.min(discountAmount, baseAmount);
    promoCodeUsed = promo.code;

    // Update promo code usage
    await PromoCode.updateOne(
      { _id: promo._id },
      { $inc: { current_uses: 1 }, $push: { used_by: user._id.toString() } }
    );
  }

  const totalAmount = baseAmount - discountAmount;
  const bookingId = generateBookingId();
  const paymentId = generatePaymentId();

  // Create booking
  await Booking.create({
    booking_id: bookingId,
    user_id: user._id.toString(),
    user_email: user.email,
    user_phone: user.phone_number,
    equipment_id: equipment.equipment_id,
    equipment_name: equipment.name,
    hostel_name: user.hostel_name,
    room_number: user.room_number,
    booking_date: bookingDate,
    start_time: startDateTime,
    end_time: endDateTime,
    original_end_time: endDateTime,
    hours_booked: hours,
    total_hours: hours,
    hourly_rate: hourlyRate,
    base_amount: baseAmount,
    total_amount: totalAmount,
    promo_code_used: promoCodeUsed,
    discount_amount: discountAmount,
    status: BookingStatus.PENDING,
    payment_id: paymentId,
  });

  // Create payment
  await Payment.create({
    payment_id: paymentId,
    user_id: user._id.toString(),
    user_email: user.email,
    user_phone: user.phone_number,
    booking_id: bookingId,
    payment_type: PaymentType.BOOKING,
    amount: totalAmount,
    momo_number_to: MOMO_NUMBER,
    momo_name_to: MOMO_NAME,
    status: PaymentStatus.PENDING,
  });

  // Update equipment status
  await Equipment.updateOne(
    { _id: equipment._id },
    { status: "booked", current_booking_id: bookingId }
  );

  return redirect(`/payments/${paymentId}`);
}

export default function BookingNew() {
  const { equipment, preselectedEquipment, hourlyRate, minHours, maxHours } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedEquipment, setSelectedEquipment] = useState(
    preselectedEquipment
  );
  const [hours, setHours] = useState(minHours);
  const [promoDiscount, setPromoDiscount] = useState(0);

  const selectedEquipmentData = useMemo(
    () => equipment.find((e) => e.equipment_id === selectedEquipment),
    [equipment, selectedEquipment]
  );

  const rate = selectedEquipmentData?.hourly_rate || hourlyRate;
  const baseTotal = hours * rate;
  const finalTotal = Math.max(0, baseTotal - promoDiscount);

  return (
    <AnimatedPage>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Book a Gaming Session</h1>
          <p className="text-gray-400 mt-1">
            Choose your equipment and preferred time slot
          </p>
        </div>

        {actionData?.error && (
          <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {actionData.error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Booking Form */}
          <div className="lg:col-span-2">
            <Card className="glass-card border border-white/10">
              <CardHeader className="flex items-center gap-2 px-6 pt-6">
                <Gamepad2 className="h-5 w-5 text-primary-500" />
                <h2 className="text-xl font-semibold text-white">Booking Details</h2>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <Form method="post" className="space-y-6">
                  {/* Equipment Selection */}
                  <div>
                    <Select
                      name="equipment_id"
                      label="Select Equipment"
                      placeholder="Choose a PS5 set"
                      selectedKeys={
                        selectedEquipment ? [selectedEquipment] : []
                      }
                      onSelectionChange={(keys) => {
                        const key = Array.from(keys)[0] as string;
                        setSelectedEquipment(key || "");
                      }}
                      isRequired
                      isInvalid={!!actionData?.errors?.equipment_id}
                      errorMessage={actionData?.errors?.equipment_id?.[0]}
                    >
                      {equipment.map((e) => (
                        <SelectItem key={e.equipment_id} textValue={e.name}>
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <p className="font-medium">{e.name}</p>
                              <p className="text-xs text-gray-400">
                                {e.equipment_id} - {formatCurrency(e.hourly_rate)}
                                /hr
                              </p>
                            </div>
                            <Chip
                              size="sm"
                              color={
                                e.status === "available" ? "success" : "warning"
                              }
                              variant="flat"
                            >
                              {e.status === "available"
                                ? "Available"
                                : "Unavailable"}
                            </Chip>
                          </div>
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  {/* Equipment Components Preview */}
                  {selectedEquipmentData && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-200 mb-2">
                        Included Components:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedEquipmentData.components.map(
                          (component: string, idx: number) => (
                            <Chip key={idx} size="sm" variant="flat" className="bg-white/10 text-gray-300">
                              {component}
                            </Chip>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Date and Time */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input
                      name="booking_date"
                      type="date"
                      label="Booking Date"
                      isRequired
                      variant="bordered"
                      min={new Date().toISOString().split("T")[0]}
                      isInvalid={!!actionData?.errors?.booking_date}
                      errorMessage={actionData?.errors?.booking_date?.[0]}
                      startContent={
                        <Calendar className="h-4 w-4 text-gray-400" />
                      }
                      classNames={{
                        input: "text-white",
                        label: "text-gray-400",
                        inputWrapper: "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500",
                      }}
                    />
                    <Input
                      name="start_time"
                      type="time"
                      label="Start Time"
                      isRequired
                      variant="bordered"
                      isInvalid={!!actionData?.errors?.start_time}
                      errorMessage={actionData?.errors?.start_time?.[0]}
                      startContent={
                        <Clock className="h-4 w-4 text-gray-400" />
                      }
                      classNames={{
                        input: "text-white",
                        label: "text-gray-400",
                        inputWrapper: "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500",
                      }}
                    />
                  </div>

                  {/* Hours Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-3">
                      Number of Hours: {hours}
                    </label>
                    <Slider
                      aria-label="Hours"
                      step={1}
                      minValue={minHours}
                      maxValue={maxHours}
                      value={hours}
                      onChange={(val) =>
                        setHours(typeof val === "number" ? val : val[0])
                      }
                      className="max-w-full"
                      showSteps
                      marks={Array.from(
                        { length: maxHours - minHours + 1 },
                        (_, i) => ({
                          value: minHours + i,
                          label: `${minHours + i}h`,
                        })
                      )}
                    />
                    <input type="hidden" name="hours" value={hours} />
                  </div>

                  {/* Promo Code */}
                  <Input
                    name="promo_code"
                    label="Promo Code (Optional)"
                    variant="bordered"
                    startContent={<Tag className="h-4 w-4 text-gray-400" />}
                    classNames={{
                      input: "text-white",
                      label: "text-gray-400",
                      inputWrapper: "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500",
                    }}
                  />

                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    isLoading={isSubmitting}
                    isDisabled={!selectedEquipment}
                    className="bg-primary-500 text-white neon-glow-cyan hover:bg-primary-400"
                    startContent={
                      !isSubmitting ? (
                        <CreditCard className="h-5 w-5" />
                      ) : undefined
                    }
                  >
                    Proceed to Payment
                  </Button>
                </Form>
              </CardBody>
            </Card>
          </div>

          {/* Price Preview */}
          <div>
            <Card className="glass-card gradient-border border border-white/10 sticky top-24">
              <CardHeader className="px-6 pt-6">
                <h3 className="text-lg font-semibold text-white">Price Summary</h3>
              </CardHeader>
              <CardBody className="px-6 pb-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Rate</span>
                    <span className="text-gray-200">{formatCurrency(rate)}/hr</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Hours</span>
                    <span className="text-gray-200">{hours} hours</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-gray-200">{formatCurrency(baseTotal)}</span>
                  </div>
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-sm text-success-400">
                      <span>Discount</span>
                      <span>-{formatCurrency(promoDiscount)}</span>
                    </div>
                  )}
                  <Divider className="bg-white/10" />
                  <div className="flex justify-between font-bold text-lg">
                    <span className="text-white">Total</span>
                    <span className="neon-text-cyan">
                      {formatCurrency(finalTotal)}
                    </span>
                  </div>
                </div>

                <div className="bg-primary-500/10 rounded-lg p-3 mt-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary-400 mt-0.5" />
                    <div className="text-xs text-primary-300">
                      <p className="font-medium">What's included:</p>
                      <ul className="mt-1 space-y-0.5">
                        <li>PS5 Console + TV setup</li>
                        <li>2 DualSense Controllers</li>
                        <li>Free delivery & setup</li>
                        <li>Technical support</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 text-center">
                  Payment via MTN Mobile Money
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
