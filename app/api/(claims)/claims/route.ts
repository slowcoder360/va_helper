import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claimChats } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const newClaimChat = await db.insert(claimChats)
      .values({
        userId,
        claimType: null,
        status: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: claimChats.id });

    return NextResponse.json({ claimId: newClaimChat[0].id }, { status: 200 });
  } catch (error) {
    console.error("Error creating claim:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
