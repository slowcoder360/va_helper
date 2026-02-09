import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import React from "react";
import { ChatMessage } from "@/lib/types";

type Props = {
  isLoading: boolean;
  messages: ChatMessage[];
};

const MessageList = ({ messages, isLoading }: Props) => {
  if (isLoading) {
    return (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!messages) return <></>;
  return (
    <div className="flex flex-col gap-2 px-4 mb-6">
      {messages.map((message) => {
        return (
          <div
            key={message.id}
            className={cn("flex", {
              "justify-end pl-10": message.role === "user",
              "justify-start pr-10": message.role === "assistant" || message.role === "system",
            })}
          >
            <div
              className={cn(
                "rounded-lg px-3 text-sm py-1 shadow-md ring-1 ring-gray-900/10",
                {
                  "bg-primary-600 text-white": message.role === "user",
                  "bg-chat-assistant": message.role === "assistant" && !message.agent,
                  "bg-green-50": message.role === "assistant" && message.agent === "research",
                  "bg-purple-50": message.role === "assistant" && message.agent === "writing",
                  "bg-chat-system border": message.role === "system",
                }
              )}
            >
              {message.agent && (
                <div className="text-xs font-semibold mb-1 text-muted-foreground">
                  {message.agent === "research" ? "Research Agent" : "Writing Agent"}
                </div>
              )}
              <p>{message.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;
