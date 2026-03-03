import { Check } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  { key: "pending", label: "Pending" },
  { key: "payment_received", label: "Payment" },
  { key: "confirmed", label: "Confirmed" },
  { key: "delivered", label: "Delivered" },
  { key: "in_use", label: "In Use" },
  { key: "completed", label: "Completed" },
];

const terminalStatuses = ["cancelled", "refunded"];

interface StepperProps {
  currentStatus: string;
}

export default function BookingStatusStepper({ currentStatus }: StepperProps) {
  if (terminalStatuses.includes(currentStatus)) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className={`px-4 py-2 rounded-full text-sm font-medium ${
          currentStatus === "cancelled" ? "bg-danger-50 text-danger-600" : "bg-warning-50 text-warning-600"
        }`}>
          Booking {currentStatus === "cancelled" ? "Cancelled" : "Refunded"}
        </div>
      </div>
    );
  }

  const currentIndex = steps.findIndex(s => s.key === currentStatus || (currentStatus === "extended" && s.key === "in_use") || (currentStatus === "awaiting_confirmation" && s.key === "delivered"));

  return (
    <div className="flex items-center justify-between w-full py-4 overflow-x-auto">
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: isCurrent ? 1.1 : 1 }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                  isCompleted
                    ? "bg-success-500 border-success-500 text-white"
                    : isCurrent
                    ? "bg-primary-500 border-primary-500 text-white"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </motion.div>
              <span className={`text-xs mt-1 whitespace-nowrap ${isCurrent ? "font-semibold text-primary-600" : isCompleted ? "text-success-600" : "text-gray-400"}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? "bg-success-500" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
