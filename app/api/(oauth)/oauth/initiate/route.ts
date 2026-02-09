/**
 * OAuth Initiate Route
 * 
 * Sets required cookies before VA OAuth redirect:
 * - user_id: Clerk user ID (needed on callback to link VA data)
 * - oauth_state: Random state for CSRF protection
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { userId, state } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!state) {
      return NextResponse.json(
        { error: "state is required" },
        { status: 400 }
      );
    }

    const cookieStore = cookies();

    // Set user_id cookie - needed on callback to associate VA data with user
    cookieStore.set("user_id", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes - should complete OAuth in this time
      path: "/",
    });

    // Set oauth_state cookie - for CSRF verification on callback
    cookieStore.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("OAuth initiate error:", error);
    return NextResponse.json(
      { error: "Failed to initiate OAuth" },
      { status: 500 }
    );
  }
}
