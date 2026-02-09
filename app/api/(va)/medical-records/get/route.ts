import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { veteranProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logging";

const logger = createLogger("MedicalRecordsGet");

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

    logger.info("Getting stored medical records", { userId });

    const [profile] = await db
      .select({ 
        medicalRecords: veteranProfiles.medicalRecords,
        lastUpdate: veteranProfiles.lastUpdate,
      })
      .from(veteranProfiles)
      .where(eq(veteranProfiles.userId, userId))
      .limit(1);

    const records = profile?.medicalRecords ?? [];

    const response = {
      success: true,
      data: {
        records: Array.isArray(records) ? records : [],
        lastUpdated: profile?.lastUpdate,
      },
    };

    logger.info("Medical records retrieved", { 
      userId, 
      count: Array.isArray(records) ? records.length : 0 
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Error getting medical records", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { 
        success: false,
        error: "Failed to retrieve medical records" 
      },
      { status: 500 }
    );
  }
} 