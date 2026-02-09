// components/dashboard/RecentChats.tsx
import Link from "next/link";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Shadcn card imports

interface RecentChatsProps {
  chats: { id: string; pdfName: string; status: string }[];
}

const RecentChats: React.FC<RecentChatsProps> = ({ chats }) => (
  <Card>
    <CardHeader>
      <CardTitle>Recent Document Reviews</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-4">
        {chats.map((chat) => (
          <li key={chat.id} className="flex justify-between items-center border-b py-2">
            <div>
              <p className="font-medium">{chat.pdfName}</p>
              <p className="text-sm text-muted-foreground">Status: {chat.status}</p>
            </div>
            <Link href={`/pdf-chat/${chat.id}`}>
              <button className="text-primary-600 hover:underline">View Chat</button>
            </Link>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);

export default RecentChats;
