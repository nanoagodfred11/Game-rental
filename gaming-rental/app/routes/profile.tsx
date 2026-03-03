import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Divider,
  Progress,
  Chip,
} from "@heroui/react";
import {
  User,
  Phone,
  Building2,
  DoorOpen,
  Save,
  Calendar,
  Clock,
  CreditCard,
  Award,
  Trophy,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";

import { requireUser } from "~/services/session.server";
import { Booking, BookingStatus } from "~/models/booking.server";
import { profileUpdateSchema } from "~/lib/validation";
import { User as UserModel } from "~/models/user.server";
import {
  calculateLoyaltyTier,
  formatCurrency,
} from "~/lib/constants";
import { AnimatedPage } from "~/components/ui/animated-container";

const TIER_THRESHOLDS = [
  { tier: "Bronze", min: 0, max: 500, color: "default" as const },
  { tier: "Silver", min: 500, max: 2000, color: "secondary" as const },
  { tier: "Gold", min: 2000, max: 5000, color: "warning" as const },
  { tier: "Platinum", min: 5000, max: 10000, color: "primary" as const },
];

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);

  // Calculate stats from bookings
  const completedBookings = await Booking.countDocuments({
    user_id: user._id.toString(),
    status: BookingStatus.COMPLETED,
  });

  const allBookings = await Booking.countDocuments({
    user_id: user._id.toString(),
  });

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      full_name: user.full_name,
      phone_number: user.phone_number,
      hostel_name: user.hostel_name,
      room_number: user.room_number,
      total_bookings: user.total_bookings || allBookings,
      total_hours_rented: user.total_hours_rented,
      total_amount_spent: user.total_amount_spent,
      loyalty_points: user.loyalty_points,
      created_at: user.created_at.toISOString(),
    },
    stats: {
      total_bookings: allBookings,
      completed_bookings: completedBookings,
      total_hours: user.total_hours_rented,
      total_spent: user.total_amount_spent,
    },
  };
}

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  const result = profileUpdateSchema.safeParse(data);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors, error: null, success: null };
  }

  const updates: Record<string, string> = {};
  if (result.data.full_name) updates.full_name = result.data.full_name;
  if (result.data.phone_number) updates.phone_number = result.data.phone_number;
  if (result.data.hostel_name) updates.hostel_name = result.data.hostel_name;
  if (result.data.room_number) updates.room_number = result.data.room_number;

  if (Object.keys(updates).length === 0) {
    return { error: "No changes to save", errors: null, success: null };
  }

  await UserModel.updateOne(
    { _id: user._id },
    { $set: { ...updates, updated_at: new Date() } }
  );

  return {
    success: "Profile updated successfully",
    error: null,
    errors: null,
  };
}

const TIER_GLOW: Record<string, string> = {
  Bronze: "shadow-[0_0_15px_rgba(245,158,11,0.2)]",
  Silver: "shadow-[0_0_15px_rgba(156,163,175,0.2)]",
  Gold: "shadow-[0_0_15px_rgba(234,179,8,0.2)]",
  Platinum: "neon-glow-cyan",
};

const TIER_ICON_BG: Record<string, string> = {
  Bronze: "bg-amber-500/10",
  Silver: "bg-gray-400/10",
  Gold: "bg-yellow-500/10",
  Platinum: "bg-primary-500/10",
};

export default function Profile() {
  const { user, stats } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const loyaltyTier = calculateLoyaltyTier(stats.total_spent);
  const currentTierInfo = TIER_THRESHOLDS.find((t) => t.tier === loyaltyTier) || TIER_THRESHOLDS[0];
  const nextTierInfo = TIER_THRESHOLDS[TIER_THRESHOLDS.indexOf(currentTierInfo) + 1];

  const tierProgress = nextTierInfo
    ? Math.min(
        100,
        ((stats.total_spent - currentTierInfo.min) /
          (nextTierInfo.min - currentTierInfo.min)) *
          100
      )
    : 100;

  return (
    <AnimatedPage>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">My Profile</h1>
          <p className="text-gray-400 mt-1">Manage your account information</p>
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
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Info Card */}
            <Card className="glass-card border border-white/10">
              <CardHeader className="flex items-center gap-2 px-6 pt-6">
                <User className="h-5 w-5 text-primary-500" />
                <h2 className="text-lg font-semibold text-white">Personal Information</h2>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <Form method="post" className="space-y-5">
                  <Input
                    name="full_name"
                    label="Full Name"
                    defaultValue={user.full_name}
                    variant="bordered"
                    startContent={<User className="h-4 w-4 text-gray-400" />}
                    isInvalid={!!actionData?.errors?.full_name}
                    errorMessage={actionData?.errors?.full_name?.[0]}
                    classNames={{
                      input: "text-white",
                      label: "text-gray-400",
                      inputWrapper: "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500",
                    }}
                  />
                  <Input
                    label="Email"
                    value={user.email}
                    isReadOnly
                    isDisabled
                    variant="bordered"
                    description="Email cannot be changed"
                    classNames={{
                      input: "text-gray-400",
                      label: "text-gray-400",
                      inputWrapper: "bg-white/5 border-white/10 opacity-60",
                    }}
                  />
                  <Input
                    name="phone_number"
                    label="Phone Number"
                    defaultValue={user.phone_number}
                    variant="bordered"
                    startContent={<Phone className="h-4 w-4 text-gray-400" />}
                    isInvalid={!!actionData?.errors?.phone_number}
                    errorMessage={actionData?.errors?.phone_number?.[0]}
                    classNames={{
                      input: "text-white",
                      label: "text-gray-400",
                      inputWrapper: "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500",
                    }}
                  />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input
                      name="hostel_name"
                      label="Hostel Name"
                      defaultValue={user.hostel_name}
                      variant="bordered"
                      startContent={
                        <Building2 className="h-4 w-4 text-gray-400" />
                      }
                      isInvalid={!!actionData?.errors?.hostel_name}
                      errorMessage={actionData?.errors?.hostel_name?.[0]}
                      classNames={{
                        input: "text-white",
                        label: "text-gray-400",
                        inputWrapper: "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500",
                      }}
                    />
                    <Input
                      name="room_number"
                      label="Room Number"
                      defaultValue={user.room_number}
                      variant="bordered"
                      startContent={
                        <DoorOpen className="h-4 w-4 text-gray-400" />
                      }
                      isInvalid={!!actionData?.errors?.room_number}
                      errorMessage={actionData?.errors?.room_number?.[0]}
                      classNames={{
                        input: "text-white",
                        label: "text-gray-400",
                        inputWrapper: "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500",
                      }}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="bg-primary-500 text-white"
                    isLoading={isSubmitting}
                    startContent={
                      !isSubmitting ? <Save className="h-4 w-4" /> : undefined
                    }
                  >
                    Save Changes
                  </Button>
                </Form>
              </CardBody>
            </Card>

            {/* Loyalty Tier Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className={`glass-card border border-white/10 ${TIER_GLOW[loyaltyTier] || ""}`}>
                <CardHeader className="flex items-center gap-2 px-6 pt-6">
                  <Trophy className="h-5 w-5 text-warning-500" />
                  <h2 className="text-lg font-semibold text-white">Loyalty Tier</h2>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-full ${TIER_ICON_BG[loyaltyTier] || "bg-warning-500/10"} flex items-center justify-center`}>
                      <Award className="h-6 w-6 text-warning-400" />
                    </div>
                    <div>
                      <Chip
                        size="lg"
                        color={currentTierInfo.color}
                        variant="flat"
                        className="font-semibold"
                      >
                        {loyaltyTier}
                      </Chip>
                      <p className="text-sm text-gray-400 mt-0.5">
                        Total spent: {formatCurrency(stats.total_spent)}
                      </p>
                    </div>
                  </div>
                  {nextTierInfo ? (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">{currentTierInfo.tier}</span>
                        <span className="text-gray-400">{nextTierInfo.tier}</span>
                      </div>
                      <Progress
                        aria-label="Loyalty progress"
                        value={tierProgress}
                        color="warning"
                        className="mb-2"
                      />
                      <p className="text-xs text-gray-400 text-center">
                        Spend {formatCurrency(nextTierInfo.min - stats.total_spent)}{" "}
                        more to reach {nextTierInfo.tier}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gray-400">
                      You have reached the highest tier!
                    </div>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-4">
            <Card className="glass-card border border-white/10">
              <CardBody className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {stats.total_bookings}
                    </p>
                    <p className="text-xs text-gray-400">Total Bookings</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="glass-card border border-white/10">
              <CardBody className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success-500/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-success-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.total_hours}h</p>
                    <p className="text-xs text-gray-400">Hours Rented</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="glass-card border border-white/10">
              <CardBody className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning-500/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-warning-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(stats.total_spent)}
                    </p>
                    <p className="text-xs text-gray-400">Amount Spent</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="glass-card border border-white/10">
              <CardBody className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-accent-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {stats.completed_bookings}
                    </p>
                    <p className="text-xs text-gray-400">Completed Sessions</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Divider />

            <div className="text-center text-sm text-gray-500">
              <Calendar className="h-4 w-4 inline mr-1" />
              Member since{" "}
              {new Date(user.created_at).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
