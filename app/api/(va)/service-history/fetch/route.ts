import { NextRequest, NextResponse } from "next/server";
import { vaApiClient } from "@/lib/services/vaApiClient";
import { db } from "@/lib/db";
import { serviceHistories, disabilities, userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logging";

const logger = createLogger("ServiceHistoryFetch");

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    logger.info("Fetching service history and disability ratings", { userId });

    // Fetch service history from VA API
    const serviceHistoryData = await vaApiClient.getServiceHistory(userId);

    // Clear existing service history for this user and re-insert
    await db.delete(serviceHistories).where(eq(serviceHistories.userId, userId));

    for (const history of serviceHistoryData) {
      await db.insert(serviceHistories).values({
        userId,
        branchOfService: history.branchOfService,
        startDate: history.startDate,
        endDate: history.endDate || null,
        serviceType: history.serviceType || null,
        dischargeStatus: history.dischargeStatus || null,
        rankAtDischarge: history.rankAtDischarge || null,
      });
    }

    // Fetch disability ratings from VA API
    const ratingsData = await vaApiClient.getDisabilityRatings(userId);

    // Clear existing disabilities and re-insert
    await db.delete(disabilities).where(eq(disabilities.userId, userId));

    for (const rating of ratingsData.individualRatings) {
      await db.insert(disabilities).values({
        userId,
        name: rating.name,
        diagnosticCode: rating.diagnosticCode,
        disabilityRating: rating.rating,
        staticInd: rating.isStatic,
        effectiveDate: rating.effectiveDate,
      });
    }

    // Update combined rating on user profile
    await db
      .update(userProfiles)
      .set({ combinedDisabilityRating: ratingsData.combinedRating })
      .where(eq(userProfiles.userId, userId));

    logger.info("Service history and disability data stored", {
      userId,
      serviceHistoryCount: serviceHistoryData.length,
      disabilityCount: ratingsData.individualRatings.length,
      combinedRating: ratingsData.combinedRating,
    });

    return NextResponse.json({
      success: true,
      message: "Service history and disability data stored successfully",
      data: {
        serviceHistory: serviceHistoryData,
        disabilityRatings: ratingsData,
      },
    });
  } catch (error) {
    logger.error("Error in service-history fetch route", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch service history and disability data",
      },
      { status: 500 }
    );
  }
}
