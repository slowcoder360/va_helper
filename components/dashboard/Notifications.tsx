// components/dashboard/Notifications.tsx
import Link from "next/link";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Shadcn card imports

interface NotificationsProps {
  notifications: { id: string; message: string; link: string }[];
}

const Notifications: React.FC<NotificationsProps> = ({ notifications }) => (
  <Card className="bg-gradient-to-t from-gray-100 via-gray-50 to-gray-100 bg-opacity-90 backdrop-blur-md shadow-md">
    <CardHeader>
      <CardTitle>Notifications</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-4">
        {notifications.map((notification) => (
          <li key={notification.id} className="flex justify-between items-center border-b py-2">
            <div>
              <p className="font-medium">{notification.message}</p>
            </div>
            <Link href={notification.link}>
              <button className="text-primary-600 hover:underline">View</button>
            </Link>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);

export default Notifications;
