import { NextRequest, NextResponse } from "next/server";
import { vaApiClient } from "@/lib/services/vaApiClient";
import { db } from "@/lib/db";
import { claims } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logging";

const logger = createLogger("ClaimsFetch");

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

    logger.info("Fetching claims", { userId });

    // Fetch from VA API
    const vaClaims = await vaApiClient.getClaims(userId);

    // Only delete VA-synced claims (preserve user-created ones)
    await db.delete(claims).where(
      and(eq(claims.userId, userId), eq(claims.source, "va"))
    );

    // Store claims with actual VA API data
    for (const claim of vaClaims) {
      await db.insert(claims).values({
        userId,
        claimType: claim.claimType,
        claimStatus: claim.status,
        dateSubmitted: claim.closeDate ? new Date(claim.closeDate) : new Date(),
        claimDecision: claim.closeDate ? "closed" : null,
        dateOfLastUpdate: claim.closeDate ? new Date(claim.closeDate) : new Date(),
        source: "va",
      });
    }

    logger.info("Claims stored", { userId, count: vaClaims.length });

    return NextResponse.json({
      success: true,
      message: "Claims fetched and stored",
      data: vaClaims,
    });
  } catch (error) {
    logger.error("Error fetching claims", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch claims" 
      },
      { status: 500 }
    );
  }
} 