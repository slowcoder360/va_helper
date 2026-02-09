// app/api/(oauth)/oauth/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { userTokens, serviceHistories, disabilities, userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { vaApiClient } from "@/lib/services/vaApiClient";
import { createLogger } from "@/lib/logging";

const logger = createLogger("OAuthCallback");

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
    const clientId = process.env.VA_CLIENT_ID!;
    const clientSecret = process.env.VA_CLIENT_SECRET!;
    const redirectUri = process.env.VA_OAUTH_REDIRECT_URI!;

    // Prepare the token request parameters
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    logger.info("Exchanging authorization code for tokens", { userId });

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

    logger.info("Tokens stored successfully", { userId });

    // Fetch and store veteran data using the unified API client
    // This is now properly awaited so errors are caught
    try {
      const serviceHistoryData = await vaApiClient.getServiceHistory(userId);
      logger.info("Service history fetched", { userId, count: serviceHistoryData.length });

      for (const service of serviceHistoryData) {
        await db.insert(serviceHistories).values({
          userId: userId,
          branchOfService: service.branchOfService,
          startDate: service.startDate,
          endDate: service.endDate || null,
          serviceType: service.serviceType || null,
          dischargeStatus: service.dischargeStatus || null,
          rankAtDischarge: service.rankAtDischarge || null,
        });
      }

      const ratingsData = await vaApiClient.getDisabilityRatings(userId);
      logger.info("Disability ratings fetched", {
        userId,
        combinedRating: ratingsData.combinedRating,
        count: ratingsData.individualRatings.length,
      });

      // Update the combined disability rating in the user's profile
      if (ratingsData.combinedRating !== undefined) {
        await db.update(userProfiles)
          .set({ combinedDisabilityRating: ratingsData.combinedRating })
          .where(eq(userProfiles.userId, userId));
      }

      // Store individual disability ratings
      for (const rating of ratingsData.individualRatings) {
        await db.insert(disabilities).values({
          userId: userId,
          name: rating.name,
          diagnosticCode: rating.diagnosticCode,
          disabilityRating: rating.rating,
          staticInd: rating.isStatic,
          effectiveDate: rating.effectiveDate,
          source: "va",
        });
      }

      logger.info("Veteran data stored successfully", { userId });
    } catch (dataError) {
      // Log the error but don't fail the OAuth flow -- tokens are saved
      logger.error("Error fetching/storing veteran data after OAuth", {
        userId,
        error: dataError instanceof Error ? dataError.message : String(dataError),
      });
    }

    // Redirect to the home page
    return NextResponse.redirect(new URL("/home", request.url));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("OAuth Callback Error", { error: errorMessage });
    return NextResponse.redirect(
      new URL(
        `/error?message=${encodeURIComponent("Authentication failed")}`,
        request.url
      )
    );
  }
}
