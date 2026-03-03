import { Card, CardBody } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  subtitle?: string;
}

export default function StatsCard({ title, value, icon: Icon, color = "text-primary-500", subtitle }: StatsCardProps) {
  return (
    <Card>
      <CardBody className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl bg-gray-50 ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
