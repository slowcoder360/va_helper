"use client";
import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";
import { MessageCircle, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "./ui/separator";
import { useRouter } from "next/navigation";
import axios from "axios";

type Props = {
  chats: Array<{
    id: number;
    claimType: string | null;
    status: string | null;
    createdAt: Date;
  }>;
  chatId: number;
};

const ClaimsChatSideBar = ({ chats, chatId }: Props) => {
  const router = useRouter();

  const handleNewClaim = async () => {
    try {
      // Call the API route to create a new claim
      const response = await axios.post("/api/claims");
      const newClaimId = response.data.claimId;

      // Redirect to the new claim chat page
      router.push(`/file-a-claim/${newClaimId}`);
    } catch (error) {
      console.error("Failed to start new claim:", error);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 text-white bg-gray-900">
      {/* Top: Add New Claim Button */}
      <p className="flex text-2xl font-bold justify-center mb-4">File a New Claim</p>
      <Button onClick={handleNewClaim} className="w-full mb-4">
        <PlusCircle className="mr-2 h-5 w-5" />
        Start New Claim
      </Button>
      <Separator className="mt-4" />

      {/* Middle: List of Claim Chats */}
      <div className="flex-1 mt-4 overflow-y-auto">
        {chats.map((chat) => (
          <Link key={chat.id} href={`/file-a-claim/${chat.id}`}>
            <div
              className={cn("rounded-lg p-3 text-slate-300 flex flex-col items-start", {
                "bg-primary-600 text-white": chat.id === chatId,
                "hover:text-white": chat.id !== chatId,
              })}
            >
              <div className="flex items-center">
                <MessageCircle className="mr-2" />
                <p className="text-sm font-semibold truncate">{chat.claimType || "Unknown Claim"}</p>
              </div>
              <p className="text-xs">{chat.status || "Pending"}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ClaimsChatSideBar;
