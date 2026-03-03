import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import {
  Card,
  CardBody,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea,
  Switch,
} from "@heroui/react";
import {
  Star,
  MessageSquare,
  Eye,
  EyeOff,
  Award,
  Monitor,
  User,
} from "lucide-react";
import { useState } from "react";

import { requireAdmin } from "~/services/session.server";
import { Review } from "~/models/review.server";
import { adminReviewResponseSchema } from "~/lib/validation";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  const reviews = await Review.find().sort({ created_at: -1 }).lean();

  return {
    reviews: reviews.map((r) => ({
      id: r._id.toString(),
      review_id: r.review_id,
      user_name: r.user_name,
      user_email: r.user_email,
      equipment_id: r.equipment_id,
      equipment_name: r.equipment_name,
      booking_id: r.booking_id,
      rating: r.rating,
      title: r.title || "",
      comment: r.comment || "",
      equipment_condition: r.equipment_condition,
      delivery_speed: r.delivery_speed,
      value_for_money: r.value_for_money,
      admin_response: r.admin_response || "",
      responded_at: r.responded_at ? r.responded_at.toISOString() : null,
      is_visible: r.is_visible,
      is_featured: r.is_featured,
      created_at: r.created_at.toISOString(),
    })),
  };
}

export async function action({ request }: { request: Request }) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "respond") {
    const reviewId = formData.get("reviewId") as string;
    const raw = {
      response: formData.get("response") as string,
    };

    const result = adminReviewResponseSchema.safeParse(raw);
    if (!result.success) {
      return { error: result.error.issues[0].message, intent };
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return { error: "Review not found", intent };
    }

    review.admin_response = result.data.response;
    review.responded_at = new Date();
    await review.save();

    return { success: "Response added to review", intent };
  }

  if (intent === "toggle-visibility") {
    const reviewId = formData.get("reviewId") as string;

    const review = await Review.findById(reviewId);
    if (!review) {
      return { error: "Review not found", intent };
    }

    review.is_visible = !review.is_visible;
    await review.save();

    return {
      success: `Review ${review.is_visible ? "made visible" : "hidden"}`,
      intent,
    };
  }

  if (intent === "toggle-featured") {
    const reviewId = formData.get("reviewId") as string;

    const review = await Review.findById(reviewId);
    if (!review) {
      return { error: "Review not found", intent };
    }

    review.is_featured = !review.is_featured;
    await review.save();

    return {
      success: `Review ${review.is_featured ? "featured" : "unfeatured"}`,
      intent,
    };
  }

  return { error: "Invalid action", intent };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

function SubRating({ label, rating }: { label: string; rating?: number }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <span>{label}:</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminReviews() {
  const { reviews } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const respondModal = useDisclosure();
  const [respondingReview, setRespondingReview] = useState<
    (typeof reviews)[0] | null
  >(null);

  function handleRespond(review: (typeof reviews)[0]) {
    setRespondingReview(review);
    respondModal.onOpen();
  }

  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : "0";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Review Management</h1>
          <p className="text-gray-500 mt-1">
            Manage customer reviews and feedback
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Card className="bg-surface-800 border border-white/10 px-4 py-2">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              <span className="text-xl font-bold text-white">{avgRating}</span>
              <span className="text-sm text-gray-400">
                ({reviews.length} reviews)
              </span>
            </div>
          </Card>
        </div>
      </div>

      {actionData?.error && (
        <Card className="mb-4 border-danger-500/30 bg-danger-500/10">
          <CardBody className="py-3 text-danger-400 text-sm">
            {actionData.error}
          </CardBody>
        </Card>
      )}
      {actionData?.success && (
        <Card className="mb-4 border-success-500/30 bg-success-500/10">
          <CardBody className="py-3 text-success-400 text-sm">
            {actionData.success}
          </CardBody>
        </Card>
      )}

      {reviews.length === 0 ? (
        <Card className="bg-surface-800 border border-white/10">
          <CardBody className="py-16 text-center">
            <MessageSquare className="h-16 w-16 mx-auto text-gray-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              No reviews yet
            </h3>
            <p className="text-gray-400">
              Customer reviews will appear here once submitted.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card
              key={review.id}
              className={`bg-surface-800 border border-white/10 ${!review.is_visible ? "opacity-60" : ""}`}
            >
              <CardBody className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <StarRating rating={review.rating} />
                      {review.title && (
                        <h3 className="font-semibold">{review.title}</h3>
                      )}
                      {review.is_featured && (
                        <Chip
                          size="sm"
                          color="warning"
                          variant="flat"
                          startContent={<Award className="h-3 w-3" />}
                        >
                          Featured
                        </Chip>
                      )}
                      {!review.is_visible && (
                        <Chip
                          size="sm"
                          color="danger"
                          variant="flat"
                          startContent={<EyeOff className="h-3 w-3" />}
                        >
                          Hidden
                        </Chip>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {review.user_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        {review.equipment_name}
                      </span>
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

                    {review.comment && (
                      <p className="text-gray-300 mb-3">{review.comment}</p>
                    )}

                    <div className="flex gap-4 flex-wrap">
                      <SubRating
                        label="Equipment"
                        rating={review.equipment_condition}
                      />
                      <SubRating
                        label="Delivery"
                        rating={review.delivery_speed}
                      />
                      <SubRating
                        label="Value"
                        rating={review.value_for_money}
                      />
                    </div>

                    {review.admin_response && (
                      <div className="mt-4 p-3 bg-primary-500/10 rounded-lg border-l-3 border-primary-400">
                        <p className="text-sm font-medium text-primary-400 mb-1">
                          Admin Response
                        </p>
                        <p className="text-sm text-gray-300">
                          {review.admin_response}
                        </p>
                        {review.responded_at && (
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(review.responded_at).toLocaleDateString(
                              "en-GB"
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<MessageSquare className="h-3 w-3" />}
                    onPress={() => handleRespond(review)}
                  >
                    {review.admin_response ? "Edit Response" : "Respond"}
                  </Button>

                  <Form method="post" className="inline">
                    <input
                      type="hidden"
                      name="intent"
                      value="toggle-visibility"
                    />
                    <input
                      type="hidden"
                      name="reviewId"
                      value={review.id}
                    />
                    <Button
                      size="sm"
                      variant="flat"
                      type="submit"
                      isLoading={isSubmitting}
                      startContent={
                        review.is_visible ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )
                      }
                    >
                      {review.is_visible ? "Hide" : "Show"}
                    </Button>
                  </Form>

                  <Form method="post" className="inline">
                    <input
                      type="hidden"
                      name="intent"
                      value="toggle-featured"
                    />
                    <input
                      type="hidden"
                      name="reviewId"
                      value={review.id}
                    />
                    <Button
                      size="sm"
                      variant="flat"
                      color={review.is_featured ? "warning" : "default"}
                      type="submit"
                      isLoading={isSubmitting}
                      startContent={<Award className="h-3 w-3" />}
                    >
                      {review.is_featured ? "Unfeature" : "Feature"}
                    </Button>
                  </Form>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Respond Modal */}
      <Modal
        isOpen={respondModal.isOpen}
        onOpenChange={respondModal.onOpenChange}
        size="lg"
      >
        <ModalContent>
          {(onClose) => (
            <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
              <input type="hidden" name="intent" value="respond" />
              <input
                type="hidden"
                name="reviewId"
                value={respondingReview?.id || ""}
              />
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Respond to Review</h2>
                <div className="flex items-center gap-2">
                  <StarRating rating={respondingReview?.rating || 0} />
                  <span className="text-sm text-gray-500">
                    by {respondingReview?.user_name}
                  </span>
                </div>
              </ModalHeader>
              <ModalBody>
                {respondingReview?.comment && (
                  <div className="p-3 bg-white/5 rounded-lg mb-4">
                    <p className="text-sm text-gray-300">
                      "{respondingReview.comment}"
                    </p>
                  </div>
                )}
                <Textarea
                  name="response"
                  label="Admin Response"
                  placeholder="Write your response to this review..."
                  defaultValue={respondingReview?.admin_response || ""}
                  isRequired
                  minRows={3}
                  maxRows={6}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" type="submit" isLoading={isSubmitting}>
                  Submit Response
                </Button>
              </ModalFooter>
            </Form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
