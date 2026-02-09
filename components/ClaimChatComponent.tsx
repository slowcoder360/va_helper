// ClaimChatComponent.tsx
"use client";
import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { useClaimChat } from "@/lib/hooks";
import { ChatWelcomeEmpty } from "@/components/ui/empty-states";

type Props = { chatId: number };

const ClaimChatComponent = ({ chatId }: Props) => {
  const [input, setInput] = useState("");
  const { user } = useUser();

  const {
    messages,
    isLoading,
    isSending,
    sendMessage,
  } = useClaimChat({
    chatId,
    userId: user?.id || "anonymous",
    onError: (error) => {
      console.error("Claim chat error:", error);
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <ChatLayout
      title="Claim Chat"
      messages={messages}
      inputValue={input}
      onInputChange={setInput}
      onSend={handleSend}
      isLoading={isLoading && messages.length === 0}
      isSending={isSending}
      disabled={!user}
      placeholder="Ask a question about your VA claim..."
      emptyState={<ChatWelcomeEmpty />}
    />
  );
};

export default ClaimChatComponent;
