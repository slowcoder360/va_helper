"use client";

import React, { useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Send, Loader2 } from "lucide-react";
import { ChatMessage } from "@/lib/types";
import { announce } from "@/lib/accessibility";

// ============================================
// Chat Message Component
// ============================================

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isLoading?: boolean;
}

export function ChatMessageBubble({ message, isLoading }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div
      className={cn(
        "flex w-full animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3",
          isUser && "bg-primary-600 text-white",
          !isUser && !isSystem && "bg-chat-assistant text-foreground",
          isSystem && "bg-chat-system text-foreground border",
          isLoading && "animate-pulse-soft"
        )}
      >
        {message.agent && (
          <div className="text-xs font-medium mb-1 opacity-70">
            {message.agent}
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}

// ============================================
// Chat Messages List
// ============================================

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  emptyState?: ReactNode;
}

export function ChatMessages({ messages, isLoading, emptyState }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Announce new messages to screen readers
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant" && lastMessage.id !== "loading") {
        announce("New response received", "polite");
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0 && emptyState) {
    return <div className="flex-1 flex items-center justify-center">{emptyState}</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" role="log" aria-label="Chat messages">
      {messages.map((message) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          isLoading={message.id === "loading"}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

// ============================================
// Chat Input
// ============================================

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isLoading || disabled) return;
    onSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t bg-background p-4">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading || disabled}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={!value.trim() || isLoading || disabled}
          className="bg-primary-600 hover:bg-primary-700"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
}

// ============================================
// Chat Layout Container
// ============================================

interface ChatLayoutProps {
  title: string;
  subtitle?: string;
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading?: boolean;
  isSending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyState?: ReactNode;
  headerActions?: ReactNode;
  className?: string;
}

/**
 * ChatLayout Component
 * 
 * A unified chat layout that can be used for both PDF chat and claim chat.
 * Provides consistent structure, styling, and behavior.
 */
export function ChatLayout({
  title,
  subtitle,
  messages,
  inputValue,
  onInputChange,
  onSend,
  isLoading,
  isSending,
  disabled,
  placeholder,
  emptyState,
  headerActions,
  className,
}: ChatLayoutProps) {
  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {headerActions}
        </div>
      </div>

      {/* Messages */}
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        emptyState={emptyState}
      />

      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={onInputChange}
        onSubmit={onSend}
        isLoading={isSending}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}
