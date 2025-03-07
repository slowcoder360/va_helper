// app/api/(oauth)/oauth/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { cookies } from "next/headers";
import { db } from "@/lib/db"; // Adjust the import path as necessary
import { userTokens, serviceHistories, disabilities, userProfiles } from "@/lib/db/schema"; // Adjust the import path as necessary
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      throw new Error("Authorization code is missing.");
    }
    if (!state) {
      throw new Error("State parameter is missing.");
    }

    // Retrieve the stored state from the cookie
    const cookieStore = cookies();
    const storedState = cookieStore.get("oauth_state")?.value;
    if (!storedState) {
      throw new Error("Stored state is missing.");
    }

    // Compare the returned state with the stored state
    if (state !== storedState) {
      throw new Error("Invalid state parameter.");
    }
    // Clear the state cookie as it's no longer needed
    cookieStore.delete("oauth_state");

    // Retrieve the user ID from the cookie or session
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) {
      throw new Error("User ID not found in session.");
    }

    // Set client ID and client secret from environment variables
    const clientId = process.env.VA_SERVICE_HISTORY_CLIENT_ID!;
    const clientSecret = process.env.VA_SERVICE_HISTORY_CLIENT_SECRET!;
    const redirectUri = process.env.VA_OAUTH_REDIRECT_URI!;

    // Prepare the token request parameters
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    console.log("Token Exchange Parameters:", {
      grant_type: "authorization_code",
      code: code,
      client_id: clientId,
      redirect_uri: redirectUri,
    });

    // Exchange the authorization code for tokens
    const tokenResponse = await axios.post(
      process.env.VA_TOKEN_URL!,
      tokenParams.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // Handle the token response
    const tokens = tokenResponse.data;
    console.log("Tokens received:", tokens);

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token || null;
    const expiresIn = tokens.expires_in; // In seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Store tokens in the database
    await db.insert(userTokens).values({
      userId: userId,
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: expiresAt,
    });

    // Asynchronously fetch and store service history and disability data
    (async () => {
      try {
        // ===== Service History Data =====
        const serviceHistoryResponse = await axios.get(
          `${process.env.VA_SERVICE_HISTORY_API_BASE_URL}/service_history`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        const serviceHistoryData = serviceHistoryResponse.data.data;
        console.log("Service History Data:", JSON.stringify(serviceHistoryData, null, 2));

        for (const service of serviceHistoryData) {
          console.log("Processing service record:", JSON.stringify(service, null, 2));
          const attrs = service.attributes || {};
          console.log("Extracted attributes:", JSON.stringify(attrs, null, 2));

          await db.insert(serviceHistories).values({
            userId: userId,
            branchOfService: attrs.branch_of_service,
            startDate: attrs.start_date,
            endDate: attrs.end_date ? attrs.end_date : null,
            serviceType: attrs.service_type,
            componentOfService: attrs.component_of_service,
            separationReason: attrs.separation_reason,
            dischargeStatus: attrs.discharge_status,
            rankAtDischarge: attrs.pay_grade,
            mos: attrs.mos,
          });
        }

        // ===== Disability Ratings Data =====
        const disabilityResponse = await axios.get(
          `${process.env.VA_SERVICE_HISTORY_API_BASE_URL}/disability_rating`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        const disabilityData = disabilityResponse.data.data;
        console.log("Disability Data:", JSON.stringify(disabilityData, null, 2));

        // Update the combined disability rating in the user's profile
        const combinedRating = disabilityData.attributes.combined_disability_rating;
        if (combinedRating !== undefined) {
          await db.update(userProfiles)
            .set({ combinedDisabilityRating: combinedRating })
            .where(eq(userProfiles.userId, userId));
          console.log("Updated combined disability rating:", combinedRating);
        } else {
          console.warn("No combined disability rating found in the response.");
        }

        // Store individual disability ratings
        const individualRatings = disabilityData.attributes.individual_ratings;
        if (Array.isArray(individualRatings)) {
          for (const rating of individualRatings) {
            console.log("Processing individual rating:", JSON.stringify(rating, null, 2));
            await db.insert(disabilities).values({
              userId: userId,
              name: rating.diagnostic_type_name,
              diagnosticCode: rating.diagnostic_type_code,
              disabilityRating: rating.rating_percentage,
              staticInd: rating.static_ind,
              effectiveDate: new Date(rating.effective_date).toISOString(),
            });
          }
        } else {
          console.error("individual_ratings is not an array:", individualRatings);
        }

        console.log("Service history and disability data successfully stored");
      } catch (error) {
        console.error("Error while fetching or storing VA data:", error);
      }
    })();

    // Redirect to the home page
    return NextResponse.redirect(new URL("/home", request.url));
  } catch (error: any) {
    console.error("OAuth Callback Error:", error.response?.data || error);
    return NextResponse.redirect(
      new URL(
        `/error?message=${encodeURIComponent("Authentication failed")}`,
        request.url
      )
    );
  }
}
