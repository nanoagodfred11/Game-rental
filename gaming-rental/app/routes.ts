import { type RouteConfig, index, route, layout, prefix } from "@react-router/dev/routes";

export default [
  // Public
  index("routes/_index.tsx"),
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/register", "routes/auth.register.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),

  // Customer (authenticated)
  route("equipment", "routes/equipment.tsx"),
  route("bookings", "routes/bookings.tsx"),
  route("bookings/new", "routes/bookings.new.tsx"),
  route("bookings/:bookingId", "routes/bookings.$bookingId.tsx"),
  route("payments/:paymentId", "routes/payments.$paymentId.tsx"),
  route("profile", "routes/profile.tsx"),
  route("notifications", "routes/notifications.tsx"),
  route("reviews", "routes/reviews.tsx"),
  route("waitlist", "routes/waitlist.tsx"),

  // Admin
  layout("routes/admin.tsx", [
    route("admin", "routes/admin._index.tsx"),
    route("admin/equipment", "routes/admin.equipment.tsx"),
    route("admin/bookings", "routes/admin.bookings.tsx"),
    route("admin/bookings/:bookingId", "routes/admin.bookings.$bookingId.tsx"),
    route("admin/payments", "routes/admin.payments.tsx"),
    route("admin/promo-codes", "routes/admin.promo-codes.tsx"),
    route("admin/users", "routes/admin.users.tsx"),
    route("admin/reviews", "routes/admin.reviews.tsx"),
    route("admin/analytics", "routes/admin.analytics.tsx"),
    route("admin/audit-logs", "routes/admin.audit-logs.tsx"),
  ]),

  // API resource routes
  route("api/bookings/session-time", "routes/api.bookings.session-time.ts"),
  route("api/bookings/:bookingId/confirm-delivery", "routes/api.bookings.$bookingId.confirm-delivery.ts"),
  route("api/notifications/read-all", "routes/api.notifications.read-all.ts"),
  route("api/notifications/:id/read", "routes/api.notifications.$id.read.ts"),
  route("api/promo/validate", "routes/api.promo.validate.ts"),
  route("api/promo/active", "routes/api.promo.active.ts"),
  route("api/waitlist/check", "routes/api.waitlist.check.ts"),
] satisfies RouteConfig;
