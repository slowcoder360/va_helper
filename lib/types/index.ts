/**
 * Shared TypeScript Types
 * 
 * Central location for all shared types used across the application.
 */

// Re-export VA API types
export * from "./vaApi";

// ============================================
// Message Types
// ============================================

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  content: string;
  role: MessageRole;
  agent?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

// ============================================
// Claim Types
// ============================================

export type ClaimStatus = "in_progress" | "submitted" | "under_review" | "decided" | "closed";

export interface ClaimChat {
  id: number;
  userId: string;
  claimType?: string;
  status: ClaimStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClaimSummary {
  claimId: number;
  claimType: string;
  status: string;
  dateSubmitted: Date;
  decision?: string;
  lastUpdate: Date;
}

// ============================================
// Veteran Profile Types
// ============================================

export interface VeteranServicePeriod {
  branch: string;
  startDate: string;
  endDate: string | null;
  serviceType?: string;
  dischargeStatus?: string;
  rank?: string;
}

export interface VeteranDisability {
  name: string;
  rating: number;
  diagnosticCode?: string;
  effectiveDate: string;
  isPermanent?: boolean;
}

export interface VeteranProfile {
  userId: string;
  name: string;
  email: string;
  veteranStatus?: string;
  combinedDisabilityRating?: number;
  servicePeriods: VeteranServicePeriod[];
  disabilities: VeteranDisability[];
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// Form Types
// ============================================

export interface FormFieldError {
  field: string;
  message: string;
}

export interface FormState {
  isSubmitting: boolean;
  isValid: boolean;
  errors: FormFieldError[];
}

// ============================================
// UI Types
// ============================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardCard {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
}

export interface NotificationItem {
  id: string;
  type: "info" | "warning" | "action";
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

// ============================================
// Navigation Types
// ============================================

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
  children?: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}
