import { Outlet, Link, useLocation, useLoaderData } from "react-router";
import { requireAdmin } from "~/services/session.server";
import { Booking } from "~/models/booking.server";
import { Payment } from "~/models/payment.server";
import {
  LayoutDashboard,
  Package,
  CalendarDays,
  CreditCard,
  Tag,
  Users,
  Star,
  BarChart3,
  ScrollText,
  ChevronLeft,
} from "lucide-react";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);
  const pendingPayments = await Payment.countDocuments({ status: "processing" });
  const pendingBookings = await Booking.countDocuments({
    status: { $in: ["pending", "payment_received", "awaiting_confirmation"] },
  });
  return { pendingPayments, pendingBookings };
}

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/bookings", icon: CalendarDays, label: "Bookings" },
  { to: "/admin/payments", icon: CreditCard, label: "Payments" },
  { to: "/admin/equipment", icon: Package, label: "Equipment" },
  { to: "/admin/promo-codes", icon: Tag, label: "Promo Codes" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/reviews", icon: Star, label: "Reviews" },
  { to: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/admin/audit-logs", icon: ScrollText, label: "Audit Logs" },
];

export default function AdminLayout() {
  const { pendingPayments, pendingBookings } = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-surface-900">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-800 border-r border-white/5 text-gray-300 flex-shrink-0 hidden lg:block">
        <div className="p-6">
          <Link to="/admin" className="text-xl font-bold neon-text-cyan">
            Admin Panel
          </Link>
          <div className="mt-3 h-px bg-gradient-to-r from-primary-500 via-accent-500 to-transparent" />
        </div>
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to) && item.to !== "/admin";
            const actualActive = item.end
              ? location.pathname === "/admin"
              : isActive;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  actualActive
                    ? "bg-primary-500/20 text-primary-400"
                    : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {item.label === "Payments" && pendingPayments > 0 && (
                  <span className="ml-auto bg-danger-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingPayments}
                  </span>
                )}
                {item.label === "Bookings" && pendingBookings > 0 && (
                  <span className="ml-auto bg-warning-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingBookings}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 px-3">
          <Link
            to="/equipment"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Site
          </Link>
        </div>
      </aside>

      {/* Mobile nav bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-800 border-t border-white/5 z-50 flex overflow-x-auto">
        {navItems.slice(0, 6).map((item) => {
          const isActive = item.end
            ? location.pathname === "/admin"
            : location.pathname.startsWith(item.to) && item.to !== "/admin";
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center p-3 flex-1 text-xs ${
                isActive ? "text-primary-400" : "text-gray-400"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 lg:p-8 pb-20 lg:pb-8 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
