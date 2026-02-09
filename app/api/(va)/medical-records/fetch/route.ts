import { NextRequest, NextResponse } from "next/server";
import { vaApiClient } from "@/lib/services/vaApiClient";
import { db } from "@/lib/db";
import { veteranProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logging";

const logger = createLogger("MedicalRecordsFetch");

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

    logger.info("Fetching medical records", { userId });

    // Fetch from VA API
    const records = await vaApiClient.getMedicalRecords(userId);

    // Store in veteran profile as JSONB
    // Check if veteran profile exists
    const [existingProfile] = await db
      .select()
      .from(veteranProfiles)
      .where(eq(veteranProfiles.userId, userId))
      .limit(1);

    if (existingProfile) {
      await db
        .update(veteranProfiles)
        .set({ 
          medicalRecords: records,
          lastUpdate: new Date(),
        })
        .where(eq(veteranProfiles.userId, userId));
    } else {
      await db.insert(veteranProfiles).values({
        userId,
        medicalRecords: records,
        lastUpdate: new Date(),
      });
    }

    logger.info("Medical records stored", { userId, count: records.length });

    return NextResponse.json({
      success: true,
      message: "Medical records fetched and stored",
      data: records,
    });
  } catch (error) {
    logger.error("Error fetching medical records", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch medical records" 
      },
      { status: 500 }
    );
  }
} 