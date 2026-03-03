import { Chip } from "@heroui/react";

const statusColors: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
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
  available: "success",
  booked: "primary",
  maintenance: "warning",
  processing: "primary",
  failed: "danger",
  waiting: "warning",
  notified: "primary",
  expired: "default",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  payment_received: "Payment Received",
  confirmed: "Confirmed",
  delivered: "Delivered",
  awaiting_confirmation: "Awaiting Confirmation",
  in_use: "In Use",
  extended: "Extended",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  available: "Available",
  booked: "Booked",
  maintenance: "Maintenance",
  processing: "Processing",
  failed: "Failed",
  waiting: "Waiting",
  notified: "Notified",
  expired: "Expired",
};

const glowStatuses: Record<string, string> = {
  in_use: "shadow-[0_0_8px_rgba(34,197,94,0.3)]",
  extended: "shadow-[0_0_8px_rgba(34,197,94,0.3)]",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Chip
      size="sm"
      color={statusColors[status] || "default"}
      variant="flat"
      className={glowStatuses[status] || ""}
    >
      {statusLabels[status] || status}
    </Chip>
  );
}
