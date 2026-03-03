import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  Link,
} from "react-router";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Divider,
  Chip,
} from "@heroui/react";
import {
  Bell,
  BellOff,
  Calendar,
  CreditCard,
  CheckCircle2,
  Truck,
  Clock,
  Timer,
  XCircle,
  Tag,
  Gamepad2,
  Eye,
  CheckCheck,
} from "lucide-react";

import { requireUser } from "~/services/session.server";
import { Notification } from "~/models/notification.server";
import { AnimatedPage, StaggerContainer, StaggerItem } from "~/components/ui/animated-container";

const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  booking_created: Calendar,
  payment_received: CreditCard,
  booking_confirmed: CheckCircle2,
  equipment_delivered: Truck,
  session_starting: Clock,
  session_ending: Timer,
  session_extended: Clock,
  session_completed: Gamepad2,
  booking_cancelled: XCircle,
  promo_applied: Tag,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  booking_created: "bg-primary-500/10 text-primary-400",
  payment_received: "bg-success-500/10 text-success-400",
  booking_confirmed: "bg-success-500/10 text-success-400",
  equipment_delivered: "bg-accent-500/10 text-accent-400",
  session_starting: "bg-warning-500/10 text-warning-400",
  session_ending: "bg-danger-500/10 text-danger-400",
  session_extended: "bg-primary-500/10 text-primary-400",
  session_completed: "bg-default-500/10 text-default-400",
  booking_cancelled: "bg-danger-500/10 text-danger-400",
  promo_applied: "bg-warning-500/10 text-warning-400",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);

  const notifications = await Notification.find({
    user_id: user._id.toString(),
    is_admin_notification: false,
  })
    .sort({ created_at: -1 })
    .limit(100)
    .lean();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    notifications: notifications.map((n) => ({
      id: n._id.toString(),
      notification_id: n.notification_id,
      notification_type: n.notification_type,
      title: n.title,
      message: n.message,
      booking_id: n.booking_id || null,
      is_read: n.is_read,
      created_at: n.created_at.toISOString(),
    })),
    unreadCount,
  };
}

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "mark-read") {
    const notificationId = formData.get("notification_id");
    if (!notificationId || typeof notificationId !== "string") {
      return { error: "Invalid notification" };
    }

    await Notification.updateOne(
      {
        notification_id: notificationId,
        user_id: user._id.toString(),
      },
      { is_read: true, read_at: new Date() }
    );

    return { success: true };
  }

  if (intent === "mark-all-read") {
    await Notification.updateMany(
      {
        user_id: user._id.toString(),
        is_read: false,
        is_admin_notification: false,
      },
      { is_read: true, read_at: new Date() }
    );

    return { success: true };
  }

  return { error: "Invalid action" };
}

export default function NotificationsPage() {
  const { notifications, unreadCount } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AnimatedPage>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Notifications</h1>
            <p className="text-gray-400 mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Form method="post">
              <input type="hidden" name="intent" value="mark-all-read" />
              <Button
                type="submit"
                variant="flat"
                size="sm"
                className="bg-white/5 border border-white/10"
                isLoading={isSubmitting}
                startContent={<CheckCheck className="h-4 w-4" />}
              >
                Mark All Read
              </Button>
            </Form>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="glass-card border border-white/10">
            <CardBody className="py-16 text-center">
              <BellOff className="h-16 w-16 mx-auto text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                No notifications
              </h3>
              <p className="text-gray-400">
                You will receive notifications about your bookings and sessions
                here.
              </p>
            </CardBody>
          </Card>
        ) : (
          <StaggerContainer className="space-y-2">
            {notifications.map((notification) => {
              const IconComponent =
                NOTIFICATION_ICONS[notification.notification_type] || Bell;
              const iconColorClass =
                NOTIFICATION_COLORS[notification.notification_type] ||
                "bg-white/5 text-gray-300";

              return (
                <StaggerItem key={notification.id}>
                  <Card
                    className={`glass-card border transition-colors ${
                      !notification.is_read
                        ? "border-l-4 border-l-primary-400 border-white/10 bg-primary-500/5"
                        : "border-white/10"
                    }`}
                  >
                    <CardBody className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconColorClass}`}
                        >
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p
                                className={`font-medium ${
                                  !notification.is_read
                                    ? "text-white"
                                    : "text-gray-300"
                                }`}
                              >
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-400 mt-0.5">
                                {notification.message}
                              </p>
                              {notification.booking_id && (
                                <Link
                                  to={`/bookings/${notification.booking_id}`}
                                  className="text-xs text-primary-400 hover:underline mt-1 inline-block"
                                >
                                  View Booking
                                </Link>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {timeAgo(notification.created_at)}
                              </span>
                              {!notification.is_read && (
                                <Form method="post">
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value="mark-read"
                                  />
                                  <input
                                    type="hidden"
                                    name="notification_id"
                                    value={notification.notification_id}
                                  />
                                  <Button
                                    type="submit"
                                    size="sm"
                                    variant="light"
                                    isIconOnly
                                    className="min-w-0 w-7 h-7"
                                    title="Mark as read"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </Form>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </div>
    </AnimatedPage>
  );
}
