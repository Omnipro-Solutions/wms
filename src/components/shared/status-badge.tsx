import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusMeta, type StatusVariant } from "@/lib/status";

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  success: "border-transparent bg-emerald-100 text-emerald-800",
  warning: "border-transparent bg-amber-100 text-amber-800",
  danger: "border-transparent bg-red-100 text-red-800",
  info: "border-transparent bg-blue-100 text-blue-800",
  neutral: "border-transparent bg-gray-100 text-gray-700",
  progress: "border-transparent bg-violet-100 text-violet-800",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = statusMeta(status);
  return (
    <Badge className={cn(VARIANT_CLASSES[meta.variant], className)} variant="outline">
      {meta.label}
    </Badge>
  );
}
