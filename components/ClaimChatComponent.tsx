// ClaimChatComponent.tsx
"use client";
import React, { useEffect } from "react";
import { Input } from "./ui/input";
import { useChat } from "ai/react";
import { Button } from "./ui/button";
import { Send } from "lucide-react";
import MessageList from "./MessageList";
import { Separator } from "./ui/separator";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

type Props = { chatId: number };

const ClaimChatComponent = ({ chatId }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: ["claimChat", chatId],
    queryFn: async () => {
      const response = await axios.get(`/api/claim-chat?claimChatId=${chatId}`);
      return response.data; // This should be an array of {id, content, role}
    },
  });

  const { input, handleInputChange, handleSubmit, messages, setMessages } = useChat({
    api: "/api/claim-chat",
    body: { chatId },
    initialMessages: data || [],
  });
  
  useEffect(() => {
    const messageContainer = document.getElementById("message-container");
    if (messageContainer) {
      messageContainer.scrollTo({
        top: messageContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);


  useEffect(() => {
    if (data) {
      setMessages(data);
    }
  }, [data, setMessages]);

  
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 inset-x-0 p-2 bg-white z-10">
        <h3 className="text-xl mt-1 font-bold">Claim Chat</h3>
        <Separator className="my-2" />
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto" id="message-container">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {/* Form at the Bottom */}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 bg-white p-4 border-t border-gray-200 pt-3"
      >
        <div className="flex">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a question..."
            className="w-full"
          />
          <Button className="bg-blue-600 ml-2">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ClaimChatComponent;
