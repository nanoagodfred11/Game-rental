import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { redirect } from "react-router";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Divider,
} from "@heroui/react";
import {
  Star,
  MessageSquare,
  PenLine,
  CheckCircle2,
  AlertCircle,
  Gamepad2,
} from "lucide-react";
import { useState } from "react";

import { requireUser } from "~/services/session.server";
import { Review } from "~/models/review.server";
import { Booking, BookingStatus } from "~/models/booking.server";
import { reviewCreateSchema } from "~/lib/validation";
import { generateReviewId } from "~/lib/utils.server";
import { AnimatedPage } from "~/components/ui/animated-container";

function StarRating({
  value,
  onChange,
  name,
  label,
  size = "md",
}: {
  value: number;
  onChange: (val: number) => void;
  name: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = useState(0);
  const starSize = size === "sm" ? "h-5 w-5" : "h-7 w-7";

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium mb-1.5">{label}</label>
      )}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              className={`${starSize} ${
                star <= (hovered || value)
                  ? "fill-warning-500 text-warning-500 drop-shadow-[0_0_4px_rgba(250,204,21,0.4)]"
                  : "text-gray-600"
              }`}
            />
          </button>
        ))}
        <input type="hidden" name={name} value={value} />
        {value > 0 && (
          <span className="text-sm text-gray-400 ml-2">{value}/5</span>
        )}
      </div>
    </div>
  );
}

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);

  // Get user's reviews
  const reviews = await Review.find({ user_id: user._id.toString() })
    .sort({ created_at: -1 })
    .lean();

  // Get eligible bookings (completed, no review yet)
  const reviewedBookingIds = reviews.map((r) => r.booking_id);
  const eligibleBookings = await Booking.find({
    user_id: user._id.toString(),
    status: BookingStatus.COMPLETED,
    booking_id: { $nin: reviewedBookingIds },
  })
    .sort({ completed_at: -1 })
    .lean();

  return {
    reviews: reviews.map((r) => ({
      id: r._id.toString(),
      review_id: r.review_id,
      booking_id: r.booking_id,
      equipment_name: r.equipment_name,
      rating: r.rating,
      title: r.title || "",
      comment: r.comment || "",
      equipment_condition: r.equipment_condition || 0,
      delivery_speed: r.delivery_speed || 0,
      value_for_money: r.value_for_money || 0,
      admin_response: r.admin_response || "",
      created_at: r.created_at.toISOString(),
    })),
    eligibleBookings: eligibleBookings.map((b) => ({
      id: b._id.toString(),
      booking_id: b.booking_id,
      equipment_name: b.equipment_name,
      booking_date: b.booking_date.toISOString(),
      completed_at: b.completed_at?.toISOString() || b.created_at.toISOString(),
    })),
  };
}

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  const result = reviewCreateSchema.safeParse(data);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors, error: null };
  }

  const {
    booking_id,
    rating,
    title,
    comment,
    equipment_condition,
    delivery_speed,
    value_for_money,
  } = result.data;

  // Verify booking belongs to user and is completed
  const booking = await Booking.findOne({
    booking_id,
    user_id: user._id.toString(),
    status: BookingStatus.COMPLETED,
  });

  if (!booking) {
    return {
      error: "Booking not found or not eligible for review",
      errors: null,
    };
  }

  // Check no existing review
  const existingReview = await Review.findOne({ booking_id });
  if (existingReview) {
    return {
      error: "A review already exists for this booking",
      errors: null,
    };
  }

  // Create review
  await Review.create({
    review_id: generateReviewId(),
    user_id: user._id.toString(),
    user_email: user.email,
    user_name: user.full_name,
    booking_id: booking.booking_id,
    equipment_id: booking.equipment_id,
    equipment_name: booking.equipment_name,
    rating,
    title: title || "",
    comment: comment || "",
    equipment_condition: equipment_condition || undefined,
    delivery_speed: delivery_speed || undefined,
    value_for_money: value_for_money || undefined,
    is_visible: true,
  });

  return redirect("/reviews");
}

export default function ReviewsPage() {
  const { reviews, eligibleBookings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [rating, setRating] = useState(0);
  const [equipmentCondition, setEquipmentCondition] = useState(0);
  const [deliverySpeed, setDeliverySpeed] = useState(0);
  const [valueForMoney, setValueForMoney] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState("");

  return (
    <AnimatedPage>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Reviews</h1>
          <p className="text-gray-400 mt-1">
            Share your experience with our gaming service
          </p>
        </div>

        {actionData?.error && (
          <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {actionData.error}
          </div>
        )}

        <div className="space-y-8">
          {/* Write a Review */}
          {eligibleBookings.length > 0 && (
            <Card className="glass-card border border-white/10">
              <CardHeader className="flex items-center gap-2 px-6 pt-6">
                <PenLine className="h-5 w-5 text-primary-500" />
                <h2 className="text-lg font-semibold text-white">Write a Review</h2>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <Form method="post" className="space-y-5">
                  {/* Booking Selection */}
                  <Select
                    name="booking_id"
                    label="Select Booking to Review"
                    placeholder="Choose a completed booking"
                    isRequired
                    selectedKeys={selectedBooking ? [selectedBooking] : []}
                    onSelectionChange={(keys) => {
                      const key = Array.from(keys)[0] as string;
                      setSelectedBooking(key || "");
                    }}
                    isInvalid={!!actionData?.errors?.booking_id}
                    errorMessage={actionData?.errors?.booking_id?.[0]}
                  >
                    {eligibleBookings.map((b) => (
                      <SelectItem key={b.booking_id} textValue={b.equipment_name}>
                        <div>
                          <p className="font-medium">{b.equipment_name}</p>
                          <p className="text-xs text-gray-400">
                            {b.booking_id} -{" "}
                            {new Date(b.booking_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>

                  {/* Overall Rating */}
                  <StarRating
                    name="rating"
                    label="Overall Rating"
                    value={rating}
                    onChange={setRating}
                  />
                  {actionData?.errors?.rating && (
                    <p className="text-xs text-danger-500">
                      {actionData.errors.rating[0]}
                    </p>
                  )}

                  {/* Title */}
                  <Input
                    name="title"
                    label="Review Title (Optional)"
                    variant="bordered"
                    maxLength={100}
                    isInvalid={!!actionData?.errors?.title}
                    errorMessage={actionData?.errors?.title?.[0]}
                    classNames={{
                      input: "text-white",
                      label: "text-gray-400",
                      inputWrapper: "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500",
                    }}
                  />

                  {/* Comment */}
                  <Textarea
                    name="comment"
                    label="Your Review (Optional)"
                    variant="bordered"
                    maxLength={500}
                    minRows={3}
                    isInvalid={!!actionData?.errors?.comment}
                    errorMessage={actionData?.errors?.comment?.[0]}
                    classNames={{
                      input: "text-white",
                      label: "text-gray-400",
                      inputWrapper: "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500",
                    }}
                  />

                  {/* Sub-ratings */}
                  <div>
                    <p className="text-sm font-medium mb-3">
                      Detailed Ratings (Optional)
                    </p>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <StarRating
                        name="equipment_condition"
                        label="Equipment Condition"
                        value={equipmentCondition}
                        onChange={setEquipmentCondition}
                        size="sm"
                      />
                      <StarRating
                        name="delivery_speed"
                        label="Delivery Speed"
                        value={deliverySpeed}
                        onChange={setDeliverySpeed}
                        size="sm"
                      />
                      <StarRating
                        name="value_for_money"
                        label="Value for Money"
                        value={valueForMoney}
                        onChange={setValueForMoney}
                        size="sm"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="bg-primary-500 text-white"
                    isLoading={isSubmitting}
                    isDisabled={rating === 0 || !selectedBooking}
                    startContent={
                      !isSubmitting ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : undefined
                    }
                  >
                    Submit Review
                  </Button>
                </Form>
              </CardBody>
            </Card>
          )}

          {/* No eligible bookings message */}
          {eligibleBookings.length === 0 && reviews.length === 0 && (
            <Card className="glass-card border border-white/10">
              <CardBody className="py-16 text-center">
                <MessageSquare className="h-16 w-16 mx-auto text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-300 mb-2">
                  No reviews yet
                </h3>
                <p className="text-gray-400">
                  Complete a booking to leave a review about your gaming
                  experience.
                </p>
              </CardBody>
            </Card>
          )}

          {eligibleBookings.length === 0 && reviews.length > 0 && (
            <div className="bg-white/5 rounded-lg p-4 text-sm text-gray-400 text-center">
              All your completed bookings have been reviewed. Book another session
              to leave more reviews!
            </div>
          )}

          {/* My Reviews */}
          {reviews.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">My Reviews</h2>
              <div className="space-y-4">
                {reviews.map((review) => (
                  <Card key={review.id} className="glass-card border border-white/10">
                    <CardBody className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Gamepad2 className="h-4 w-4 text-primary-500" />
                            <span className="font-semibold text-white">
                              {review.equipment_name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 font-mono">
                            {review.booking_id}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? "fill-warning-500 text-warning-500"
                                : "text-gray-600"
                            }`}
                          />
                        ))}
                        <span className="text-sm text-gray-400 ml-1">
                          {review.rating}/5
                        </span>
                      </div>

                      {review.title && (
                        <h4 className="font-medium text-white mb-1">{review.title}</h4>
                      )}
                      {review.comment && (
                        <p className="text-sm text-gray-300 mb-3">
                          {review.comment}
                        </p>
                      )}

                      {/* Sub-ratings */}
                      {(review.equipment_condition > 0 ||
                        review.delivery_speed > 0 ||
                        review.value_for_money > 0) && (
                        <div className="flex gap-4 flex-wrap text-xs text-gray-400 mb-3">
                          {review.equipment_condition > 0 && (
                            <span>
                              Equipment: {review.equipment_condition}/5
                            </span>
                          )}
                          {review.delivery_speed > 0 && (
                            <span>
                              Delivery: {review.delivery_speed}/5
                            </span>
                          )}
                          {review.value_for_money > 0 && (
                            <span>
                              Value: {review.value_for_money}/5
                            </span>
                          )}
                        </div>
                      )}

                      {/* Admin Response */}
                      {review.admin_response && (
                        <>
                          <Divider className="my-3" />
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-500 mb-1">
                              Response from PS5 Rental:
                            </p>
                            <p className="text-sm text-gray-300">
                              {review.admin_response}
                            </p>
                          </div>
                        </>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
