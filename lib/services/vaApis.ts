// lib/services/vaApi.ts

import axios from "axios";
import { db } from "@/lib/db";
import { userTokens, serviceHistories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Retrieves the user's service history from the VA API.
 * @param userId - The user's ID.
 * @returns The user's service history data.
 */
export async function getUserServiceHistory(userId: string) {
  // Retrieve the user's tokens from the database
  const [tokenRecord] = await db
    .select()
    .from(userTokens)
    .where(eq(userTokens.userId, userId));

  if (!tokenRecord) {
    throw new Error("User tokens not found.");
  }

  let accessToken = tokenRecord.accessToken;

  // Check if the access token is expired
  if (new Date() > tokenRecord.expiresAt) {
    try {
      // Refresh the access token
      accessToken = await refreshAccessToken(userId);
    } catch (error) {
      throw new Error("Unable to refresh access token.");
    }
  }

  // Make the API call to the VA Service History endpoint
  const response = await axios.get(
    `${process.env.VA_SERVICE_HISTORY_API_BASE_URL}/service_history`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const serviceHistoryData = response.data;
  return serviceHistoryData;
}

/**
 * Refreshes the access token using the refresh token.
 * @param userId - The user's ID.
 * @returns The new access token.
 */
export async function refreshAccessToken(userId: string) {
  // Retrieve the user's tokens from the database
  const [tokenRecord] = await db
    .select()
    .from(userTokens)
    .where(eq(userTokens.userId, userId));

  if (!tokenRecord || !tokenRecord.refreshToken) {
    throw new Error("Refresh token not available.");
  }

  const refreshToken = tokenRecord.refreshToken;

  const tokenParams = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.VA_SERVICE_HISTORY_CLIENT_ID!,
    client_secret: process.env.VA_SERVICE_HISTORY_CLIENT_SECRET!,
  });

  // Exchange the refresh token for a new access token
  const tokenResponse = await axios.post(
    process.env.VA_TOKEN_URL!,
    tokenParams.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  // Update the tokens in the database
  const tokens = tokenResponse.data;
  const newAccessToken = tokens.access_token;
  const newExpiresIn = tokens.expires_in;
  const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000);
  const newRefreshToken = tokens.refresh_token || refreshToken;

  await db
    .update(userTokens)
    .set({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
    })
    .where(eq(userTokens.userId, userId));

  return newAccessToken;
}

/**
 * Stores the user's service history data in the database.
 * @param userId - The user's ID.
 * @param serviceHistoryData - The service history data fetched from the VA API.
 */
export async function storeServiceHistoryInDB(
  userId: string,
  serviceHistoryData: any
) {
  // Example structure of serviceHistoryData:
  // {
  //   data: [
  //     {
  //       branchOfService: "Army",
  //       beginDate: "2001-01-01",
  //       endDate: "2005-01-01",
  //       personnelCategoryTypeCode: "V",
  //       // ...other fields
  //     },
  //     // ...more entries
  //   ]
  // }

  // Delete existing service history entries for the user (optional)
  await db
    .delete(serviceHistories)
    .where(eq(serviceHistories.userId, userId));

  // Insert new service history entries
  const entries = serviceHistoryData.data.map((item: any) => ({
    userId: userId,
    branchOfService: item.branchOfService,
    startDate: item.beginDate ? new Date(item.beginDate) : null,
    endDate: item.endDate ? new Date(item.endDate) : null,
    dischargeStatus: item.personnelCategoryTypeCode || null,
    // Add other fields as necessary
  }));

  if (entries.length > 0) {
    await db.insert(serviceHistories).values(entries);
  }
}
