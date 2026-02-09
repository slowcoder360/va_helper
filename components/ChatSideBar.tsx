"use client";
import { DrizzleChat } from "@/lib/db/schema";
import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";
import { MessageCircle, PlusCircle, Home } from "lucide-react"; // Add Home icon
import { cn } from "@/lib/utils";
import FileUpload from "./fileUpload";
import { Separator } from "./ui/separator";

type Props = {
  chats: DrizzleChat[];
  chatId: number;
};

const ChatSideBar = ({ chats, chatId }: Props) => {
  return (
    <div className="w-full h-full flex flex-col p-4 text-white bg-gray-900">
      {/* Top: New Chat Button */}
        <p className=" flex text-2xl font-bold justify-center">
          Add A New Document
        </p>
        <FileUpload />
        <Separator className="mt-4 "/>

      {/* Middle: List of Chats */}
      <div className="flex-1 mt-4 overflow-y-auto">
        {chats.map((chat) => (
          <Link key={chat.id} href={`/pdf-chat/${chat.id}`}>
            <div
              className={cn("rounded-lg p-3 text-slate-300 flex items-center", {
                "bg-primary-600 text-white": chat.id === chatId,
                "hover:text-white": chat.id !== chatId,
              })}
            >
              <MessageCircle className="mr-2" />
              <p className="w-full overflow-hidden text-sm truncate whitespace-nowrap text-ellipsis">
                {chat.pdfName}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ChatSideBar;
