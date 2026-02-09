import { NextRequest, NextResponse } from "next/server";
import { vaApiClient } from "@/lib/services/vaApiClient";
import { db } from "@/lib/db";
import { disabilities, userProfiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logging";

const logger = createLogger("DisabilityRatingsFetch");

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

    logger.info("Fetching disability ratings", { userId });

    // Fetch from VA API
    const ratings = await vaApiClient.getDisabilityRatings(userId);

    // Only delete VA-synced disability records (preserve user-created ones)
    await db.delete(disabilities).where(
      and(eq(disabilities.userId, userId), eq(disabilities.source, "va"))
    );

    // Store individual ratings
    for (const rating of ratings.individualRatings) {
      await db.insert(disabilities).values({
        userId,
        name: rating.name,
        diagnosticCode: rating.diagnosticCode,
        disabilityRating: rating.rating,
        staticInd: rating.isStatic,
        effectiveDate: rating.effectiveDate,
        source: "va",
      });
    }

    // Update combined rating on user profile
    await db
      .update(userProfiles)
      .set({ combinedDisabilityRating: ratings.combinedRating })
      .where(eq(userProfiles.userId, userId));

    logger.info("Disability ratings stored", { 
      userId, 
      combinedRating: ratings.combinedRating,
      individualCount: ratings.individualRatings.length 
    });

    return NextResponse.json({
      success: true,
      message: "Disability ratings fetched and stored",
      data: ratings,
    });
  } catch (error) {
    logger.error("Error fetching disability ratings", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch disability ratings" 
      },
      { status: 500 }
    );
  }
} 