import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disabilities, userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logging";

const logger = createLogger("DisabilityRatingsGet");

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

    logger.info("Getting stored disability ratings", { userId });

    // Get individual ratings
    const disabilityRecords = await db
      .select()
      .from(disabilities)
      .where(eq(disabilities.userId, userId));

    // Get combined rating from user profile
    const [profile] = await db
      .select({ combinedRating: userProfiles.combinedDisabilityRating })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    const response = {
      success: true,
      data: {
        combinedRating: profile?.combinedRating ?? 0,
        individualRatings: disabilityRecords.map(d => ({
          name: d.name,
          diagnosticCode: d.diagnosticCode,
          rating: d.disabilityRating,
          isStatic: d.staticInd,
          effectiveDate: d.effectiveDate,
        })),
      },
    };

    logger.info("Disability ratings retrieved", { 
      userId, 
      count: disabilityRecords.length 
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Error getting disability ratings", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { 
        success: false,
        error: "Failed to retrieve disability ratings" 
      },
      { status: 500 }
    );
  }
} 