import { Link, useLoaderData, useSearchParams } from "react-router";
import {
  Card,
  CardBody,
  Button,
  Chip,
  Tabs,
  Tab,
} from "@heroui/react";
import {
  Gamepad2,
  Calendar,
  Clock,
  Plus,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

import { requireUser } from "~/services/session.server";
import { Booking } from "~/models/booking.server";
import StatusBadge from "~/components/ui/status-badge";
import { formatCurrency } from "~/lib/constants";
import { AnimatedPage, StaggerContainer, StaggerItem } from "~/components/ui/animated-container";
import { DualSenseController } from "~/components/ui/ps5-svg";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
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
  const user = await requireUser(request);
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "all";

  let query: Record<string, any> = { user_id: user._id.toString() };

  if (statusFilter === "active") {
    query.status = { $in: ACTIVE_STATUSES };
  } else if (statusFilter === "pending") {
    query.status = "pending";
  } else if (statusFilter === "completed") {
    query.status = "completed";
  } else if (statusFilter === "cancelled") {
    query.status = { $in: ["cancelled", "refunded"] };
  }

  const bookings = await Booking.find(query)
    .sort({ created_at: -1 })
    .lean();

  return {
    bookings: bookings.map((b) => ({
      id: b._id.toString(),
      booking_id: b.booking_id,
      equipment_name: b.equipment_name,
      equipment_id: b.equipment_id,
      booking_date: b.booking_date.toISOString(),
      start_time: b.start_time.toISOString(),
      end_time: b.end_time.toISOString(),
      hours_booked: b.hours_booked,
      total_hours: b.total_hours,
      total_amount: b.total_amount,
      status: b.status,
      created_at: b.created_at.toISOString(),
    })),
    statusFilter,
  };
}

export default function BookingsList() {
  const { bookings, statusFilter } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  function handleFilterChange(key: string | number) {
    const newParams = new URLSearchParams(searchParams);
    if (key === "all") {
      newParams.delete("status");
    } else {
      newParams.set("status", String(key));
    }
    setSearchParams(newParams);
  }

  return (
    <AnimatedPage>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">My Bookings</h1>
            <p className="text-gray-400 mt-1">
              Manage your gaming session bookings
            </p>
          </div>
          <Link to="/bookings/new">
            <Button
              className="bg-primary-500 text-white neon-glow-cyan hover:bg-primary-400"
              startContent={<Plus className="h-4 w-4" />}
            >
              New Booking
            </Button>
          </Link>
        </div>

        {/* Status Filter Tabs */}
        <div className="overflow-x-auto -mx-4 px-4 mb-6">
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
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <Card className="glass-card border border-white/10">
            <CardBody className="py-16 text-center">
              <DualSenseController className="w-32 h-32 mx-auto mb-4 opacity-60" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                No bookings yet
              </h3>
              <p className="text-gray-400 mb-6">
                {statusFilter === "all"
                  ? "You haven't made any bookings. Book a gaming session to get started!"
                  : `No ${statusFilter} bookings found.`}
              </p>
              <Link to="/bookings/new">
                <Button
                  className="bg-primary-500 text-white neon-glow-cyan hover:bg-primary-400"
                  startContent={<Plus className="h-4 w-4" />}
                >
                  Book Now
                </Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <StaggerContainer className="space-y-4">
            {bookings.map((booking) => (
              <StaggerItem key={booking.id}>
                <Link
                  to={`/bookings/${booking.booking_id}`}
                  className="block"
                >
                  <Card
                    isPressable
                    className="glass-card border border-white/10 hover:neon-glow-cyan transition-shadow w-full"
                  >
                    <CardBody className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Gamepad2 className="h-5 w-5 text-primary-500" />
                            <h3 className="font-semibold text-lg text-white">
                              {booking.equipment_name}
                            </h3>
                            <StatusBadge status={booking.status} />
                          </div>

                          <div className="flex items-center gap-6 text-sm text-gray-400">
                            <span className="font-mono text-xs text-gray-500">
                              {booking.booking_id}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(booking.booking_date).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(booking.start_time).toLocaleTimeString(
                                "en-GB",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}{" "}
                              -{" "}
                              {new Date(booking.end_time).toLocaleTimeString(
                                "en-GB",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                            <span>{booking.total_hours}h</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold neon-text-cyan">
                              {formatCurrency(booking.total_amount)}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </AnimatedPage>
  );
}
