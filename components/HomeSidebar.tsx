"use client";

import Link from "next/link";
import React, { useState } from "react";
import { MessageCircle, FileText, Settings, Home, UserRoundPen } from "lucide-react";
import UploadDialog from "./UploadDialog";
import axios from "axios";
import { useRouter } from "next/navigation";

interface HomeSidebarProps {
  firstChat: string | null;
}

const HomeSidebar: React.FC<HomeSidebarProps> = ({ firstChat }) => {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const openDialog = () => {
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  // New function to handle creating a claim and navigating to it
  const handleNewClaim = async () => {
    try {
      // Create a new claim using your /api/claims endpoint
      const response = await axios.post("/api/claims");
      const newClaimId = response.data.claimId;

      // Redirect to the new claim chat page
      router.push(`/file-a-claim/${newClaimId}`);
    } catch (error) {
      console.error("Failed to start new claim:", error);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 bg-primary-800 sticky top-0">
      {/* Middle: List of Links */}

      {/* Instead of a direct link, add a button to create a new claim */}
      <button
        onClick={handleNewClaim}
        className="rounded-lg p-3 text-white font-bold flex items-center hover:text-slate-400"
        aria-label="Submit A Claim"
      >
        <FileText className="mr-2" aria-hidden="true" focusable="false" />
        <p className="w-full text-md">Submit A Claim</p>
      </button>

      {firstChat ? (
        <Link href={`/pdf-chat/${firstChat}`}>
          <div
            className="rounded-lg p-3 text-white font-bold flex items-center hover:text-slate-400"
            aria-label="Chat with Your Docs"
          >
            <MessageCircle className="mr-2" aria-hidden="true" focusable="false" />
            <p className="w-full text-md">Chat with Your Docs</p>
          </div>
        </Link>
      ) : (
        <>
          <button
            onClick={openDialog}
            className="rounded-lg p-3 text-white font-bold flex items-center hover:text-slate-400 cursor-pointer"
            aria-label="Upload Document"
          >
            <FileText className="mr-2" aria-hidden="true" focusable="false" />
            <p className="w-full text-md">Upload Document</p>
          </button>
          {isDialogOpen && (
            <UploadDialog closeDialog={closeDialog} />
          )}
        </>
      )}

      <Link href="/profile">
        <div
          className="rounded-lg p-3 text-white font-bold flex items-center hover:text-slate-400"
          aria-label="Profile"
        >
          <Settings className="mr-2" aria-hidden="true" focusable="false" />
          <p className="w-full text-md">Profile</p>
        </div>
      </Link>
      <Link href="/settings">
        <div
          className="rounded-lg p-3 text-white font-bold flex items-center hover:text-slate-400"
          aria-label="Settings"
        >
          <UserRoundPen className="mr-2" aria-hidden="true" focusable="false" />
          <p className="w-full text-md">Settings</p>
        </div>
      </Link>

      {/* Bottom: Home Button */}
      <div className="mt-auto flex justify-center">
        <Link href="/home">
          <div className="rounded-lg p-3 text-white font-bold flex items-center hover:text-slate-400">
            <Home className="mr-2 w-6 h-6" aria-hidden="true" focusable="false" />
            <p className="w-full text-md">Home</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default HomeSidebar;
