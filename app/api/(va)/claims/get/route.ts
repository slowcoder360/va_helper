import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claims } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logging";

const logger = createLogger("ClaimsGet");

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

    logger.info("Getting stored claims", { userId });

    const userClaims = await db
      .select()
      .from(claims)
      .where(eq(claims.userId, userId));

    const response = {
      success: true,
      data: userClaims.map(c => ({
        claimId: c.claimId,
        claimType: c.claimType,
        status: c.claimStatus,
        dateSubmitted: c.dateSubmitted,
        decision: c.claimDecision,
        lastUpdate: c.dateOfLastUpdate,
      })),
    };

    logger.info("Claims retrieved", { userId, count: userClaims.length });

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Error getting claims", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { 
        success: false,
        error: "Failed to retrieve claims" 
      },
      { status: 500 }
    );
  }
} 