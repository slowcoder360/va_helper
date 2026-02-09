"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileText,
  Loader2
} from "lucide-react";

// ============================================
// Status Badge Component
// ============================================

type StatusType = 
  | "pending" 
  | "in_progress" 
  | "review" 
  | "approved" 
  | "denied" 
  | "closed"
  | "submitted";

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

// Uses status.* colors from tailwind.config.ts with opacity modifier for backgrounds
const statusConfig: Record<string, { 
  bg: string; 
  text: string; 
  icon: typeof Clock;
  label: string;
}> = {
  pending: {
    bg: "bg-status-pending/15",
    text: "text-status-pending",
    icon: Clock,
    label: "Pending",
  },
  in_progress: {
    bg: "bg-status-inProgress/15",
    text: "text-status-inProgress",
    icon: Loader2,
    label: "In Progress",
  },
  review: {
    bg: "bg-status-review/15",
    text: "text-status-review",
    icon: FileText,
    label: "Under Review",
  },
  submitted: {
    bg: "bg-status-inProgress/15",
    text: "text-status-inProgress",
    icon: FileText,
    label: "Submitted",
  },
  approved: {
    bg: "bg-status-approved/15",
    text: "text-status-approved",
    icon: CheckCircle2,
    label: "Approved",
  },
  denied: {
    bg: "bg-status-denied/15",
    text: "text-status-denied",
    icon: XCircle,
    label: "Denied",
  },
  closed: {
    bg: "bg-status-closed/15",
    text: "text-status-closed",
    icon: AlertCircle,
    label: "Closed",
  },
};

export function StatusBadge({ 
  status, 
  label,
  showIcon = true, 
  size = "md",
  className 
}: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase().replace(/\s+/g, "_")] || {
    bg: "bg-gray-100",
    text: "text-gray-800",
    icon: AlertCircle,
    label: status,
  };
  
  const Icon = config.icon;
  const displayLabel = label || config.label;
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };
  
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        config.bg,
        config.text,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={cn(iconSizes[size], status === "in_progress" && "animate-spin")} />}
      {displayLabel}
    </span>
  );
}

// ============================================
// Rating Display Component
// ============================================

interface RatingDisplayProps {
  rating: number;
  maxRating?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function RatingDisplay({ 
  rating, 
  maxRating = 100,
  showLabel = true,
  size = "md",
  className 
}: RatingDisplayProps) {
  const percentage = Math.min(100, (rating / maxRating) * 100);
  
  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };
  
  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  // Color based on rating level
  const getColor = (pct: number) => {
    if (pct >= 70) return "bg-green-500";
    if (pct >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex justify-between items-center">
          <span className={cn("font-semibold", textSizes[size])}>
            {rating}%
          </span>
          <span className={cn("text-muted-foreground", textSizes[size])}>
            Combined Rating
          </span>
        </div>
      )}
      <div className={cn("w-full bg-muted rounded-full overflow-hidden", sizeClasses[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", getColor(percentage))}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={rating}
          aria-valuemin={0}
          aria-valuemax={maxRating}
        />
      </div>
    </div>
  );
}

// ============================================
// Service Branch Badge
// ============================================

interface BranchBadgeProps {
  branch: string;
  className?: string;
}

const branchColors: Record<string, string> = {
  army: "bg-green-700 text-white",
  navy: "bg-blue-900 text-white",
  "air force": "bg-blue-600 text-white",
  marines: "bg-red-700 text-white",
  "coast guard": "bg-orange-600 text-white",
  "space force": "bg-slate-800 text-white",
};

export function BranchBadge({ branch, className }: BranchBadgeProps) {
  const colors = branchColors[branch.toLowerCase()] || "bg-gray-600 text-white";
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium",
        colors,
        className
      )}
    >
      {branch}
    </span>
  );
}
