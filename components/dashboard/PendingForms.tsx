// components/dashboard/PendingForms.tsx
import Link from "next/link";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Shadcn card imports

interface PendingFormsProps {
  forms: { id: string; title: string; dueDate: string }[];
}

const PendingForms: React.FC<PendingFormsProps> = ({ forms }) => (
  <Card>
    <CardHeader>
      <CardTitle>Pending VA Forms</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-4">
        {forms.map((form) => (
          <li key={form.id} className="flex justify-between items-center border-b py-2">
            <div>
              <p className="font-medium">{form.title}</p>
              <p className="text-sm text-muted-foreground">Due Date: {form.dueDate}</p>
            </div>
            <Link href={`/form/${form.id}`}>
              <button className="text-primary-600 hover:underline">Complete Form</button>
            </Link>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);

export default PendingForms;
