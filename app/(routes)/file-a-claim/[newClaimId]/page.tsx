// file-a-claim/[newClaimId]/page.tsx
import ClaimChatComponent from "@/components/ClaimChatComponent";
import ClaimsChatSideBar from "@/components/ClaimsChatSideBar";
import { db } from "@/lib/db";
import { claimChats } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import React from "react";

type Props = {
  params: {
    newClaimId: string;
  };
};

const FileAClaimPage = async ({ params: { newClaimId } }: Props) => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  // Fetch the claim chats for the user
  const userChats = await db.select().from(claimChats).where(eq(claimChats.userId, userId));

  const currentChat = userChats.find((chat) => chat.id === parseInt(newClaimId));
  
  // Ensure a valid chat is loaded; otherwise, redirect
  if (!currentChat) {
    return <p className="text-center mt-4">Start a new claim by selecting the option above.</p>;
  }

  return (
    <div className="flex h-full">
      <div className="flex w-full">
        {/* Chat Sidebar */}
        <div className="flex-[2] max-w-xs overflow-y-auto bg-gray-900">
          <ClaimsChatSideBar chats={userChats} chatId={parseInt(newClaimId)} />
        </div>

        {/* Claim Chat Component */}
        <div className="flex-[5] border-l-4 border-l-slate-200">
          <ClaimChatComponent chatId={parseInt(newClaimId)} />
        </div>
      </div>
    </div>
  );
};

export default FileAClaimPage;
