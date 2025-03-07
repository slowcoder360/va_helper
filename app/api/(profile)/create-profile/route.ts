import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // Adjust based on your database configuration
import { userProfiles } from "@/lib/db/schema"; // Import the correct schema for userProfiles
import { auth } from "@clerk/nextjs/server";  // Import Clerk's auth verification

export async function POST(request: Request) {
  try {
    // Check for authenticated session using Clerk
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the request body
    const body = await request.json();

    // Destructure the fields from the request body
    const { email, firstName, lastName, ssn, dateOfBirth, phoneNumber, street, city, state, zipCode } = body;

    // Insert the new profile into the userProfiles table
    const insertedProfile = await db
      .insert(userProfiles)
      .values({
        userId,  // Clerk user ID
        email,
        firstName,
        lastName,
        ssn,
        dateOfBirth,
        phoneNumber,
        street,
        city,
        state,
        zipCode,
      })
      .returning({ insertedId: userProfiles.userId });

    console.log("User profile successfully inserted with ID:", insertedProfile[0].insertedId);

    // Create the response and set the 'user_id' cookie
    const response = NextResponse.json(
      {
        message: "Profile created successfully",
        profileId: insertedProfile[0].insertedId,
      },
      { status: 200 }
    );

    // Set the cookie so that it is available in subsequent requests (like your OAuth callback)
    response.cookies.set("user_id", userId, {
      path: "/", // ensures the cookie is available on all routes
      httpOnly: true, // helps prevent XSS attacks
      secure: process.env.NODE_ENV === "production", // set to true in production
      sameSite: "lax", // allows the cookie to be sent on cross-site navigations (like OAuth callbacks)
    });

    return response;
  } catch (dbError) {
    console.error("Error inserting user profile into the database:", dbError);
    return NextResponse.json({ error: "Database insertion failed" }, { status: 500 });
  }
}
