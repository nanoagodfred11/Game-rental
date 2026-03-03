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
  Switch,
  Slider,
  Textarea,
  Divider,
  Chip,
} from "@heroui/react";
import {
  Clock,
  Calendar,
  Users,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  ListOrdered,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";

import { requireUser } from "~/services/session.server";
import { Waitlist, WaitlistStatus } from "~/models/waitlist.server";
import { waitlistCreateSchema } from "~/lib/validation";
import { generateWaitlistId } from "~/lib/utils.server";
import { MIN_BOOKING_HOURS, MAX_BOOKING_HOURS } from "~/lib/constants";
import StatusBadge from "~/components/ui/status-badge";
import { AnimatedPage } from "~/components/ui/animated-container";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);

  const entries = await Waitlist.find({
    user_id: user._id.toString(),
  })
    .sort({ created_at: -1 })
    .lean();

  // Calculate queue positions for active entries
  const entriesWithPosition = await Promise.all(
    entries.map(async (entry) => {
      let position = 0;
      if (entry.status === WaitlistStatus.WAITING) {
        // Count entries ahead of this one for the same date
        position = await Waitlist.countDocuments({
          preferred_date: entry.preferred_date,
          status: WaitlistStatus.WAITING,
          created_at: { $lt: entry.created_at },
        });
        position += 1; // 1-based position
      }

      return {
        id: entry._id.toString(),
        waitlist_id: entry.waitlist_id,
        preferred_date: entry.preferred_date.toISOString(),
        preferred_hours: entry.preferred_hours,
        flexible_hours: entry.flexible_hours,
        status: entry.status,
        notes: entry.notes || "",
        position,
        notified_at: entry.notified_at?.toISOString() || null,
        notification_expires_at:
          entry.notification_expires_at?.toISOString() || null,
        created_at: entry.created_at.toISOString(),
      };
    })
  );

  return {
    entries: entriesWithPosition,
    minHours: MIN_BOOKING_HOURS,
    maxHours: MAX_BOOKING_HOURS,
  };
}

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "join") {
    const data = Object.fromEntries(formData);
    // The Switch component in HeroUI doesn't submit a value when unchecked
    // so we need to handle the flexible_hours field
    if (!data.flexible_hours) {
      data.flexible_hours = "false";
    }

    const result = waitlistCreateSchema.safeParse(data);
    if (!result.success) {
      return { errors: result.error.flatten().fieldErrors, error: null };
    }

    const { preferred_date, preferred_hours, flexible_hours, notes } =
      result.data;

    const preferredDateObj = new Date(preferred_date);
    if (isNaN(preferredDateObj.getTime())) {
      return { error: "Invalid date", errors: null };
    }

    // Check if date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (preferredDateObj < today) {
      return { error: "Date must be today or in the future", errors: null };
    }

    // Check if user already has an active waitlist entry for this date
    const existingEntry = await Waitlist.findOne({
      user_id: user._id.toString(),
      preferred_date: preferredDateObj,
      status: { $in: [WaitlistStatus.WAITING, WaitlistStatus.NOTIFIED] },
    });

    if (existingEntry) {
      return {
        error: "You already have an active waitlist entry for this date",
        errors: null,
      };
    }

    await Waitlist.create({
      waitlist_id: generateWaitlistId(),
      user_id: user._id.toString(),
      user_email: user.email,
      user_phone: user.phone_number,
      preferred_date: preferredDateObj,
      preferred_hours: preferred_hours,
      flexible_hours: flexible_hours,
      notes: notes || "",
      status: WaitlistStatus.WAITING,
    });

    return redirect("/waitlist");
  }

  if (intent === "cancel") {
    const waitlistId = formData.get("waitlist_id");
    if (!waitlistId || typeof waitlistId !== "string") {
      return { error: "Invalid waitlist entry", errors: null };
    }

    const entry = await Waitlist.findOne({
      waitlist_id: waitlistId,
      user_id: user._id.toString(),
    });

    if (!entry) {
      return { error: "Waitlist entry not found", errors: null };
    }

    if (
      entry.status !== WaitlistStatus.WAITING &&
      entry.status !== WaitlistStatus.NOTIFIED
    ) {
      return { error: "This entry cannot be cancelled", errors: null };
    }

    entry.status = WaitlistStatus.CANCELLED;
    await entry.save();

    return { success: "Waitlist entry cancelled", error: null, errors: null };
  }

  return { error: "Invalid action", errors: null };
}

export default function WaitlistPage() {
  const { entries, minHours, maxHours } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [hours, setHours] = useState(minHours);
  const [flexibleHours, setFlexibleHours] = useState(true);

  const activeEntries = entries.filter(
    (e) => e.status === "waiting" || e.status === "notified"
  );
  const pastEntries = entries.filter(
    (e) => e.status !== "waiting" && e.status !== "notified"
  );

  return (
    <AnimatedPage>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Waitlist</h1>
          <p className="text-gray-400 mt-1">
            Join the queue when all equipment is booked
          </p>
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

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Join Waitlist Form */}
          <div className="lg:col-span-2">
            <Card className="glass-card border border-white/10">
              <CardHeader className="flex items-center gap-2 px-6 pt-6">
                <Plus className="h-5 w-5 text-primary-500" />
                <h2 className="text-lg font-semibold text-white">Join Waitlist</h2>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <Form method="post" className="space-y-5">
                  <input type="hidden" name="intent" value="join" />

                  <Input
                    name="preferred_date"
                    type="date"
                    label="Preferred Date"
                    isRequired
                    min={new Date().toISOString().split("T")[0]}
                    startContent={
                      <Calendar className="h-4 w-4 text-gray-400" />
                    }
                    isInvalid={!!actionData?.errors?.preferred_date}
                    errorMessage={actionData?.errors?.preferred_date?.[0]}
                  />

                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Preferred Hours: {hours}
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
                      showSteps
                      className="max-w-full"
                      marks={Array.from(
                        { length: maxHours - minHours + 1 },
                        (_, i) => ({
                          value: minHours + i,
                          label: `${minHours + i}h`,
                        })
                      )}
                    />
                    <input type="hidden" name="preferred_hours" value={hours} />
                  </div>

                  <div className="flex items-center justify-between bg-white/5 rounded-lg p-4">
                    <div>
                      <p className="font-medium text-sm">Flexible Hours</p>
                      <p className="text-xs text-gray-400">
                        Accept a shorter session if a slot opens up
                      </p>
                    </div>
                    <Switch
                      name="flexible_hours"
                      isSelected={flexibleHours}
                      onValueChange={setFlexibleHours}
                      value="true"
                    />
                  </div>

                  <Textarea
                    name="notes"
                    label="Notes (Optional)"
                    placeholder="Any preferences or special requests..."
                    maxLength={200}
                    minRows={2}
                  />

                  <Button
                    type="submit"
                    className="bg-primary-500 text-white"
                    fullWidth
                    isLoading={isSubmitting}
                    startContent={
                      !isSubmitting ? (
                        <Users className="h-4 w-4" />
                      ) : undefined
                    }
                  >
                    Join Waitlist
                  </Button>
                </Form>
              </CardBody>
            </Card>
          </div>

          {/* How it Works */}
          <div>
            <Card className="glass-card border border-white/10 sticky top-24">
              <CardHeader className="px-6 pt-6">
                <h3 className="text-lg font-semibold text-white">How Waitlist Works</h3>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <ol className="space-y-4 text-sm">
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-primary-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      1
                    </div>
                    <p className="text-gray-300">
                      Join the waitlist for your preferred date and hours
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-primary-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      2
                    </div>
                    <p className="text-gray-300">
                      When a slot opens up, you will be notified based on your
                      position in the queue
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-primary-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      3
                    </div>
                    <p className="text-gray-300">
                      Book your session quickly before the hold expires
                    </p>
                  </li>
                </ol>
                <Divider className="my-4" />
                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    Notification holds typically last 15 minutes. Book before it
                    expires!
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Active Waitlist Entries */}
        {activeEntries.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary-500" />
              Active Entries
            </h2>
            <div className="space-y-3">
              {activeEntries.map((entry) => (
                <Card key={entry.id} className="glass-card border border-white/10">
                  <CardBody className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {entry.position > 0 && (
                          <div className="w-12 h-12 rounded-full neon-glow-cyan bg-primary-500/10 flex items-center justify-center">
                            <span className="text-xl font-bold neon-text-cyan">
                              #{entry.position}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-white">
                              {new Date(entry.preferred_date).toLocaleDateString(
                                "en-GB",
                                {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </span>
                            <StatusBadge status={entry.status} />
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {entry.preferred_hours} hours
                              {entry.flexible_hours && " (flexible)"}
                            </span>
                            <span className="font-mono text-xs text-gray-500">
                              {entry.waitlist_id}
                            </span>
                          </div>
                          {entry.notes && (
                            <p className="text-xs text-gray-400 mt-1">
                              {entry.notes}
                            </p>
                          )}
                          {entry.notified_at && (
                            <p className="text-xs text-primary-400 mt-1">
                              Notified at{" "}
                              {new Date(entry.notified_at).toLocaleString("en-GB")}
                              {entry.notification_expires_at && (
                                <span>
                                  {" "}
                                  - Expires{" "}
                                  {new Date(
                                    entry.notification_expires_at
                                  ).toLocaleTimeString("en-GB", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <Form method="post">
                        <input type="hidden" name="intent" value="cancel" />
                        <input
                          type="hidden"
                          name="waitlist_id"
                          value={entry.waitlist_id}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          color="danger"
                          variant="flat"
                          isLoading={isSubmitting}
                          startContent={<X className="h-3.5 w-3.5" />}
                        >
                          Cancel
                        </Button>
                      </Form>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Past Entries */}
        {pastEntries.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-gray-400" />
              Past Entries
            </h2>
            <div className="space-y-3">
              {pastEntries.map((entry) => (
                <Card key={entry.id} className="glass-card border border-white/10 opacity-60">
                  <CardBody className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-300">
                            {new Date(entry.preferred_date).toLocaleDateString(
                              "en-GB",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>
                          <StatusBadge status={entry.status} />
                        </div>
                        <p className="text-xs text-gray-400">
                          {entry.preferred_hours} hours - {entry.waitlist_id}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(entry.created_at).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {entries.length === 0 && (
          <div className="mt-8">
            <Card className="glass-card border border-white/10">
              <CardBody className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                <h3 className="text-lg font-semibold text-gray-300 mb-1">
                  No waitlist entries
                </h3>
                <p className="text-sm text-gray-400">
                  Use the form above to join the waitlist when equipment is
                  unavailable.
                </p>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
