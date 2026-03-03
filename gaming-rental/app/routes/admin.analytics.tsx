import { useLoaderData } from "react-router";
import { Card, CardBody } from "@heroui/react";
import {
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Star,
  Monitor,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import { requireAdmin } from "~/services/session.server";
import { Booking, BookingStatus } from "~/models/booking.server";
import { Payment, PaymentStatus } from "~/models/payment.server";
import { Equipment } from "~/models/equipment.server";
import { User } from "~/models/user.server";
import { Review } from "~/models/review.server";
import { formatCurrency } from "~/lib/constants";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  // Revenue over last 12 months
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const payments = await Payment.find({
    status: PaymentStatus.COMPLETED,
    created_at: { $gte: twelveMonthsAgo },
  }).lean();

  const revenueByMonth: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    revenueByMonth[key] = 0;
  }

  payments.forEach((p) => {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (revenueByMonth[key] !== undefined) {
      revenueByMonth[key] += p.amount;
    }
  });

  const revenueData = Object.entries(revenueByMonth).map(([month, amount]) => {
    const [year, m] = month.split("-");
    const date = new Date(Number(year), Number(m) - 1);
    return {
      month: date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      amount,
    };
  });

  // Peak booking hours distribution
  const allBookings = await Booking.find({
    status: { $nin: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
  }).lean();

  const hourDistribution: Record<number, number> = {};
  for (let h = 0; h < 24; h++) {
    hourDistribution[h] = 0;
  }

  allBookings.forEach((b) => {
    if (b.start_time) {
      const hour = new Date(b.start_time).getHours();
      hourDistribution[hour]++;
    }
  });

  const peakHoursData = Object.entries(hourDistribution).map(
    ([hour, count]) => ({
      hour: `${String(hour).padStart(2, "0")}:00`,
      bookings: count,
    })
  );

  // Equipment performance
  const equipment = await Equipment.find().lean();
  const equipmentPerformance = equipment.map((eq) => ({
    name: eq.name,
    equipment_id: eq.equipment_id,
    total_bookings: eq.total_bookings,
    total_hours: eq.total_hours_rented,
    total_revenue: eq.total_revenue,
    status: eq.status,
  }));

  // Top 5 customers by amount spent
  const topCustomers = await User.find({ role: "customer" })
    .sort({ total_amount_spent: -1 })
    .limit(5)
    .lean();

  const topCustomersData = topCustomers.map((u) => ({
    full_name: u.full_name,
    email: u.email,
    total_bookings: u.total_bookings,
    total_amount_spent: u.total_amount_spent,
    loyalty_points: u.loyalty_points,
  }));

  // Booking status distribution
  const statusCounts: Record<string, number> = {};
  allBookings.forEach((b) => {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  });

  const bookingStatusData = Object.entries(statusCounts).map(
    ([status, count]) => ({
      status,
      count,
    })
  );

  // Average rating
  const reviews = await Review.find().lean();
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  // Summary stats
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalBookings = allBookings.length;
  const totalUsers = await User.countDocuments({ role: "customer" });
  const activeBookings = await Booking.countDocuments({
    status: {
      $in: [
        BookingStatus.CONFIRMED,
        BookingStatus.DELIVERED,
        BookingStatus.IN_USE,
        BookingStatus.EXTENDED,
      ],
    },
  });

  return {
    revenueData,
    peakHoursData,
    equipmentPerformance,
    topCustomers: topCustomersData,
    bookingStatusData,
    avgRating: Number(avgRating.toFixed(1)),
    totalReviews: reviews.length,
    summary: {
      totalRevenue,
      totalBookings,
      totalUsers,
      activeBookings,
    },
  };
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="bg-surface-800 border border-white/10">
      <CardBody className="p-5">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default function AdminAnalytics() {
  const {
    revenueData,
    peakHoursData,
    equipmentPerformance,
    topCustomers,
    bookingStatusData,
    avgRating,
    totalReviews,
    summary,
  } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Business performance overview and insights
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          icon={DollarSign}
          color="bg-success-500/10 text-success-500"
        />
        <SummaryCard
          title="Total Bookings"
          value={String(summary.totalBookings)}
          icon={Calendar}
          color="bg-primary-500/10 text-primary-400"
        />
        <SummaryCard
          title="Total Customers"
          value={String(summary.totalUsers)}
          icon={Users}
          color="bg-accent-500/10 text-accent-400"
        />
        <SummaryCard
          title="Average Rating"
          value={`${avgRating} / 5`}
          icon={Star}
          color="bg-warning-500/10 text-warning-500"
        />
      </div>

      {/* Revenue Chart */}
      <Card className="bg-surface-800 border border-white/10 mb-8">
        <CardBody className="p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-500" />
            Revenue (Last 12 Months)
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" fontSize={12} stroke="#9ca3af" />
                <YAxis fontSize={12} tickFormatter={(v) => `${v}`} stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: any) => [
                    formatCurrency(value),
                    "Revenue",
                  ]}
                  contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#06b6d4" }}
                  activeDot={{ r: 6, fill: "#22d3ee" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Peak Hours Chart */}
      <Card className="bg-surface-800 border border-white/10 mb-8">
        <CardBody className="p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-500" />
            Peak Booking Hours
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="hour" fontSize={11} stroke="#9ca3af" />
                <YAxis fontSize={12} stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: any) => [value, "Bookings"]}
                  contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" }}
                />
                <Bar
                  dataKey="bookings"
                  fill="#a855f7"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Equipment Performance */}
        <Card className="bg-surface-800 border border-white/10">
          <CardBody className="p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary-500" />
              Equipment Performance
            </h2>
            <div className="space-y-4">
              {equipmentPerformance.map((eq) => (
                <div
                  key={eq.equipment_id}
                  className="p-4 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{eq.name}</h3>
                      <span className="text-xs font-mono text-gray-400">
                        {eq.equipment_id}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-primary-400">
                      {formatCurrency(eq.total_revenue)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>{eq.total_bookings} bookings</span>
                    <span>{eq.total_hours} hours</span>
                  </div>
                </div>
              ))}
              {equipmentPerformance.length === 0 && (
                <p className="text-gray-400 text-center py-4">
                  No equipment data
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Top Customers */}
        <Card className="bg-surface-800 border border-white/10">
          <CardBody className="p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary-500" />
              Top 5 Customers
            </h2>
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <div
                  key={customer.email}
                  className="flex items-center gap-4 p-3 bg-white/5 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {customer.full_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {customer.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-400">
                      {formatCurrency(customer.total_amount_spent)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {customer.total_bookings} bookings
                    </p>
                  </div>
                </div>
              ))}
              {topCustomers.length === 0 && (
                <p className="text-gray-400 text-center py-4">
                  No customer data
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Booking Status Distribution */}
      <Card className="bg-surface-800 border border-white/10 mb-8">
        <CardBody className="p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-500" />
            Booking Status Distribution
          </h2>
          <div className="flex flex-wrap gap-3">
            {bookingStatusData.map((item) => {
              const colorMap: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
                pending: "warning",
                payment_received: "primary",
                confirmed: "primary",
                delivered: "secondary",
                awaiting_confirmation: "warning",
                in_use: "success",
                extended: "success",
                completed: "default",
                cancelled: "danger",
                refunded: "danger",
              };
              return (
                <Card key={item.status} className="min-w-[140px] bg-white/5 border border-white/10">
                  <CardBody className="p-3 text-center">
                    <p className="text-2xl font-bold text-white">{item.count}</p>
                    <p className="text-xs text-gray-400 capitalize mt-1">
                      {item.status.replace(/_/g, " ")}
                    </p>
                  </CardBody>
                </Card>
              );
            })}
            {bookingStatusData.length === 0 && (
              <p className="text-gray-400">No booking data</p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
