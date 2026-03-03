import { Link, useLoaderData } from "react-router";
import { Card, CardBody, CardHeader, Button, Divider } from "@heroui/react";
import {
  Users,
  CalendarDays,
  DollarSign,
  Package,
  AlertTriangle,
  CreditCard,
  Clock,
  TrendingUp,
  ChevronRight,
  Activity,
} from "lucide-react";

import { requireAdmin } from "~/services/session.server";
import { User } from "~/models/user.server";
import { Booking, BookingStatus } from "~/models/booking.server";
import { Payment, PaymentStatus } from "~/models/payment.server";
import { Equipment } from "~/models/equipment.server";
import { formatCurrency } from "~/lib/constants";
import StatusBadge from "~/components/ui/status-badge";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  // Count totals
  const totalUsers = await User.countDocuments({ role: "customer" });
  const activeBookings = await Booking.countDocuments({
    status: {
      $in: [
        BookingStatus.CONFIRMED,
        BookingStatus.DELIVERED,
        BookingStatus.AWAITING_CONFIRMATION,
        BookingStatus.IN_USE,
        BookingStatus.EXTENDED,
      ],
    },
  });

  // Total revenue from completed payments
  const revenueAgg = await Payment.aggregate([
    { $match: { status: PaymentStatus.COMPLETED } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

  // Equipment counts
  const totalEquipment = await Equipment.countDocuments();
  const availableEquipment = await Equipment.countDocuments({ status: "available" });

  // Today's bookings
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todaysBookings = await Booking.countDocuments({
    booking_date: { $gte: todayStart, $lte: todayEnd },
    status: { $nin: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
  });

  // This week's revenue
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekRevenueAgg = await Payment.aggregate([
    {
      $match: {
        status: PaymentStatus.COMPLETED,
        created_at: { $gte: weekStart },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const weekRevenue = weekRevenueAgg.length > 0 ? weekRevenueAgg[0].total : 0;

  // Pending actions
  const pendingPayments = await Payment.countDocuments({ status: PaymentStatus.PROCESSING });
  const pendingBookings = await Booking.countDocuments({
    status: { $in: [BookingStatus.PENDING, BookingStatus.PAYMENT_RECEIVED, BookingStatus.AWAITING_CONFIRMATION] },
  });

  // Recent bookings (last 10)
  const recentBookings = await Booking.find()
    .sort({ created_at: -1 })
    .limit(10)
    .lean();

  return {
    stats: {
      totalUsers,
      activeBookings,
      totalRevenue,
      totalEquipment,
      availableEquipment,
      todaysBookings,
      weekRevenue,
    },
    pendingActions: {
      pendingPayments,
      pendingBookings,
    },
    recentBookings: recentBookings.map((b) => ({
      id: b._id.toString(),
      booking_id: b.booking_id,
      user_email: b.user_email,
      equipment_name: b.equipment_name,
      status: b.status,
      total_amount: b.total_amount,
      booking_date: b.booking_date.toISOString(),
      start_time: b.start_time.toISOString(),
      end_time: b.end_time.toISOString(),
      created_at: b.created_at.toISOString(),
    })),
  };
}

export default function AdminDashboard() {
  const { stats, pendingActions, recentBookings } = useLoaderData<typeof loader>();

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-primary-400",
      bg: "bg-primary-500/10",
      link: "/admin/users",
    },
    {
      label: "Active Bookings",
      value: stats.activeBookings,
      icon: CalendarDays,
      color: "text-success-500",
      bg: "bg-success-500/10",
      link: "/admin/bookings",
    },
    {
      label: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: "text-accent-400",
      bg: "bg-accent-500/10",
      link: "/admin/analytics",
    },
    {
      label: "Equipment",
      value: `${stats.availableEquipment}/${stats.totalEquipment} available`,
      icon: Package,
      color: "text-warning-500",
      bg: "bg-warning-500/10",
      link: "/admin/equipment",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your rental business</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <Link key={card.label} to={card.link}>
            <Card isPressable className="bg-surface-800 border border-white/10 hover:border-primary-500/30 transition-all">
              <CardBody className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                </div>
                <p className="text-2xl font-bold text-white">{card.value}</p>
                <p className="text-sm text-gray-400 mt-1">{card.label}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card className="bg-surface-800 border border-white/10">
          <CardBody className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.todaysBookings}</p>
                <p className="text-sm text-gray-400">Today&apos;s Bookings</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card className="bg-surface-800 border border-white/10">
          <CardBody className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(stats.weekRevenue)}</p>
                <p className="text-sm text-gray-400">This Week&apos;s Revenue</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Pending Actions */}
      {(pendingActions.pendingPayments > 0 || pendingActions.pendingBookings > 0) && (
        <Card className="bg-surface-800 border-2 border-warning-500/30">
          <CardHeader className="flex items-center gap-2 px-6 pt-6">
            <AlertTriangle className="h-5 w-5 text-warning-500" />
            <h2 className="text-lg font-semibold text-white">Pending Actions</h2>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            <div className="space-y-3">
              {pendingActions.pendingPayments > 0 && (
                <Link to="/admin/payments?status=processing">
                  <div className="flex items-center justify-between p-4 bg-warning-500/10 rounded-lg hover:bg-warning-500/15 transition-colors">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-warning-500" />
                      <div>
                        <p className="font-medium text-warning-500">
                          {pendingActions.pendingPayments} payment{pendingActions.pendingPayments > 1 ? "s" : ""} to verify
                        </p>
                        <p className="text-sm text-warning-500/70">
                          MoMo payments awaiting confirmation
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-warning-500/50" />
                  </div>
                </Link>
              )}
              {pendingActions.pendingBookings > 0 && (
                <Link to="/admin/bookings?status=pending">
                  <div className="flex items-center justify-between p-4 bg-warning-500/10 rounded-lg hover:bg-warning-500/15 transition-colors">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-warning-500" />
                      <div>
                        <p className="font-medium text-warning-500">
                          {pendingActions.pendingBookings} booking{pendingActions.pendingBookings > 1 ? "s" : ""} needing attention
                        </p>
                        <p className="text-sm text-warning-500/70">
                          Bookings awaiting processing or confirmation
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-warning-500/50" />
                  </div>
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Recent Bookings */}
      <Card className="bg-surface-800 border border-white/10">
        <CardHeader className="flex items-center justify-between px-6 pt-6">
          <h2 className="text-lg font-semibold text-white">Recent Bookings</h2>
          <Link to="/admin/bookings">
            <Button size="sm" variant="flat" endContent={<ChevronRight className="h-4 w-4" />}>
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardBody className="px-6 pb-6">
          {recentBookings.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No bookings yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="pb-3 font-medium">Booking ID</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Equipment</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-white/5">
                      <td className="py-3">
                        <Link
                          to={`/admin/bookings/${booking.booking_id}`}
                          className="font-mono text-xs text-primary-400 hover:underline"
                        >
                          {booking.booking_id}
                        </Link>
                      </td>
                      <td className="py-3 text-gray-400">{booking.user_email}</td>
                      <td className="py-3 text-white">{booking.equipment_name}</td>
                      <td className="py-3 text-gray-400">
                        {new Date(booking.booking_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="py-3 font-medium text-white">{formatCurrency(booking.total_amount)}</td>
                      <td className="py-3">
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
