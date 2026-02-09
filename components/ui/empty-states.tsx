"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FileText,
  MessageSquare,
  ClipboardList,
  User,
  Upload,
  Search,
  Bell,
  Shield,
  Plus,
} from "lucide-react";

// ============================================
// Base Empty State Component
// ============================================

interface EmptyStateBaseProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

function EmptyStateBase({ icon, title, description, action, className }: EmptyStateBaseProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="bg-primary-600 hover:bg-primary-700">
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================
// Specific Empty States
// ============================================

interface EmptyStateProps {
  onAction?: () => void;
  className?: string;
}

export function NoClaimsEmpty({ onAction, className }: EmptyStateProps) {
  return (
    <EmptyStateBase
      icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
      title="No Claims Yet"
      description="You haven't filed any VA claims yet. Start a new claim to get the benefits you deserve."
      action={onAction ? {
        label: "Start a New Claim",
        onClick: onAction,
        icon: <Plus className="h-4 w-4 mr-2" />,
      } : undefined}
      className={className}
    />
  );
}

export function NoDocumentsEmpty({ onAction, className }: EmptyStateProps) {
  return (
    <EmptyStateBase
      icon={<FileText className="h-8 w-8 text-muted-foreground" />}
      title="No Documents"
      description="You haven't uploaded any documents yet. Upload your VA letters, medical records, or other supporting documents."
      action={onAction ? {
        label: "Upload Document",
        onClick: onAction,
        icon: <Upload className="h-4 w-4 mr-2" />,
      } : undefined}
      className={className}
    />
  );
}

export function NoChatsEmpty({ onAction, className }: EmptyStateProps) {
  return (
    <EmptyStateBase
      icon={<MessageSquare className="h-8 w-8 text-muted-foreground" />}
      title="No Conversations"
      description="Start a conversation to get help with your VA claims, understand your benefits, or ask questions."
      action={onAction ? {
        label: "Start Chat",
        onClick: onAction,
        icon: <MessageSquare className="h-4 w-4 mr-2" />,
      } : undefined}
      className={className}
    />
  );
}

export function NoDisabilitiesEmpty({ onAction, className }: EmptyStateProps) {
  return (
    <EmptyStateBase
      icon={<Shield className="h-8 w-8 text-muted-foreground" />}
      title="No Disabilities on File"
      description="We don't have any disability ratings on file. Connect to VA.gov to sync your disability information."
      action={onAction ? {
        label: "Sync from VA.gov",
        onClick: onAction,
      } : undefined}
      className={className}
    />
  );
}

export function NoNotificationsEmpty({ className }: EmptyStateProps) {
  return (
    <EmptyStateBase
      icon={<Bell className="h-8 w-8 text-muted-foreground" />}
      title="No Notifications"
      description="You're all caught up! We'll notify you when there are updates to your claims or important information."
      className={className}
    />
  );
}

export function NoSearchResultsEmpty({ query, onClear, className }: EmptyStateProps & { query?: string; onClear?: () => void }) {
  return (
    <EmptyStateBase
      icon={<Search className="h-8 w-8 text-muted-foreground" />}
      title="No Results Found"
      description={query ? `We couldn't find anything matching "${query}". Try adjusting your search terms.` : "No results match your search criteria."}
      action={onClear ? {
        label: "Clear Search",
        onClick: onClear,
      } : undefined}
      className={className}
    />
  );
}

export function ProfileIncompleteEmpty({ onAction, className }: EmptyStateProps) {
  return (
    <EmptyStateBase
      icon={<User className="h-8 w-8 text-muted-foreground" />}
      title="Complete Your Profile"
      description="Finish setting up your profile to get personalized assistance with your VA claims."
      action={onAction ? {
        label: "Complete Profile",
        onClick: onAction,
      } : undefined}
      className={className}
    />
  );
}

// ============================================
// Chat Empty State (Welcome Message)
// ============================================

export function ChatWelcomeEmpty({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="h-20 w-20 rounded-full bg-primary-100 flex items-center justify-center mb-6">
        <MessageSquare className="h-10 w-10 text-primary-600" />
      </div>
      <h3 className="text-xl font-semibold mb-2">VA Claims Assistant</h3>
      <p className="text-muted-foreground max-w-md mb-8">
        I'm here to help you navigate the VA disability claims process. Ask me about:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
        {[
          "Filing a new disability claim",
          "Understanding rating criteria",
          "Required evidence and documentation",
          "Checking claim status",
        ].map((topic) => (
          <div
            key={topic}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-primary-600" />
            {topic}
          </div>
        ))}
      </div>
    </div>
  );
}
