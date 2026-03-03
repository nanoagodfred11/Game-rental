import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface BookingTimerProps {
  bookingId: string;
  endTime: string;
  status: string;
}

export default function BookingTimer({ bookingId, endTime, status }: BookingTimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const calcRemaining = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((end - now) / 1000));
    };
    setRemaining(calcRemaining());
    const timer = setInterval(() => setRemaining(calcRemaining()), 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  // Sync with server every 30s
  useEffect(() => {
    if (status !== "in_use" && status !== "extended") return;
    const sync = async () => {
      try {
        const res = await fetch(`/api/bookings/session-time?bookingId=${bookingId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.end_time) {
            const end = new Date(data.end_time).getTime();
            setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)));
          }
        }
      } catch {}
    };
    const interval = setInterval(sync, 30000);
    return () => clearInterval(interval);
  }, [bookingId, status]);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const isWarning = remaining < 1800; // 30 min
  const isCritical = remaining < 900; // 15 min
  const isExpired = remaining === 0;

  const bgColor = isExpired
    ? "bg-gray-100 text-gray-500"
    : isCritical
    ? "bg-danger-50 text-danger-600"
    : isWarning
    ? "bg-warning-50 text-warning-600"
    : "bg-success-50 text-success-600";

  return (
    <div className={`rounded-xl p-6 text-center ${bgColor} ${isCritical && !isExpired ? "animate-pulse" : ""}`}>
      <div className="flex items-center justify-center gap-2 mb-2">
        {isCritical && !isExpired ? (
          <AlertTriangle className="h-5 w-5" />
        ) : (
          <Clock className="h-5 w-5" />
        )}
        <span className="font-medium text-sm">
          {isExpired ? "Session Ended" : "Time Remaining"}
        </span>
      </div>
      <div className="text-4xl font-mono font-bold">
        {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      {isCritical && !isExpired && (
        <p className="text-sm mt-2">Session ending soon! Consider extending.</p>
      )}
    </div>
  );
}
