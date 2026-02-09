/**
 * useClaimChat Hook
 * 
 * Custom hook for managing claim chat state and interactions.
 */

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ChatMessage, ChatState } from "@/lib/types";

interface UseClaimChatOptions {
  chatId?: number;
  userId: string;
  onError?: (error: Error) => void;
}

interface ClaimChatResponse {
  messages: ChatMessage[];
  claimChatId: string;
}

export function useClaimChat({ chatId, userId, onError }: UseClaimChatOptions) {
  const queryClient = useQueryClient();
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(
    chatId?.toString()
  );

  // Fetch chat history
  const {
    data,
    isLoading: isLoadingHistory,
    error: historyError,
    refetch,
  } = useQuery<ClaimChatResponse>({
    queryKey: ["claimChat", currentChatId, userId],
    queryFn: async () => {
      const response = await axios.post<ClaimChatResponse>("/api/claim-chat", {
        messages: [],
        userId,
        claimChatId: currentChatId,
      });
      return response.data;
    },
    enabled: !!userId,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // Update current chat ID when data comes back
  useEffect(() => {
    if (data?.claimChatId && data.claimChatId !== currentChatId) {
      setCurrentChatId(data.claimChatId);
    }
  }, [data?.claimChatId, currentChatId]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const messages = [...(data?.messages || []), ...optimisticMessages];
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content,
        role: "user",
      };
      
      const response = await axios.post<ClaimChatResponse>("/api/claim-chat", {
        messages: [...messages, userMessage],
        userId,
        claimChatId: currentChatId,
      });
      
      return response.data;
    },
    onMutate: async (content) => {
      // Optimistic update
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content,
        role: "user",
      };
      const loadingMessage: ChatMessage = {
        id: "loading",
        content: "Thinking...",
        role: "assistant",
      };
      
      setOptimisticMessages([userMessage, loadingMessage]);
    },
    onSuccess: (response) => {
      // Clear optimistic messages and update cache
      setOptimisticMessages([]);
      if (response.claimChatId) {
        setCurrentChatId(response.claimChatId);
      }
      queryClient.setQueryData(
        ["claimChat", response.claimChatId, userId],
        response
      );
    },
    onError: (error) => {
      // Clear loading message and show error
      setOptimisticMessages((prev) =>
        prev.filter((m) => m.id !== "loading").concat({
          id: `error-${Date.now()}`,
          content: "Sorry, there was an error. Please try again.",
          role: "assistant",
        })
      );
      onError?.(error instanceof Error ? error : new Error(String(error)));
    },
  });

  // Combined messages (server + optimistic)
  const messages: ChatMessage[] = [
    ...(data?.messages || []),
    ...optimisticMessages,
  ];

  // Send message handler
  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      sendMessageMutation.mutate(content);
    },
    [sendMessageMutation]
  );

  // Clear chat handler
  const clearChat = useCallback(() => {
    setOptimisticMessages([]);
    setCurrentChatId(undefined);
    queryClient.removeQueries({ queryKey: ["claimChat"] });
  }, [queryClient]);

  return {
    messages,
    isLoading: isLoadingHistory || sendMessageMutation.isPending,
    isSending: sendMessageMutation.isPending,
    error: historyError || sendMessageMutation.error,
    chatId: currentChatId,
    sendMessage,
    clearChat,
    refetch,
  };
}
