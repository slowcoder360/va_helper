// app/api/service-history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; // Import the db with complete schema setup
import { userTokens, serviceHistories, disabilities } from "@/lib/db/schema"; // Import relevant tables
import { eq } from "drizzle-orm"; // Import the `eq` operator
import { getServiceHistory, getDisabilityRatings } from "@/lib/services/vaServices";

// Define an interface for tokens
interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      throw new Error("User ID is missing.");
    }

    // Fetch the user's tokens from the userTokens table
    const tokens = await db
      .select()
      .from(userTokens)
      .where(eq(userTokens.userId, userId))
      .then((rows) => rows[0]);

    if (!tokens) {
      throw new Error("No tokens found for the user.");
    }

    // Fetch service history from VA API using the access token
    const serviceHistoryData = await getServiceHistory(tokens.accessToken);

    // Store service history in the database
    await storeServiceHistoryInDB(userId, serviceHistoryData);

    // Fetch disability ratings from VA API using the access token
    const disabilityData = await getDisabilityRatings(tokens.accessToken);

    // Store disability ratings in the database
    await storeDisabilityRatingsInDB(userId, disabilityData);

    return NextResponse.json({ message: "Service history and disability data stored successfully" });
  } catch (error: any) {
    console.error("Error in service-history route:", error.message);
    return NextResponse.json({ error: "Failed to store service history and disability data" }, { status: 500 });
  }
}

async function storeServiceHistoryInDB(userId: string, serviceHistoryData: any) {
  for (const history of serviceHistoryData) {
    // Log the entire history record for context
    console.log("Full history record:", JSON.stringify(history, null, 2));

    // Extract the attributes object (or an empty object if not present)
    const attrs = history.attributes || {};

    // Log the attributes from the API response
    console.log("Attributes from API:", JSON.stringify(attrs, null, 2));

    // Map the API response to the insert object
    const mappedData = {
      userId,
      branchOfService: attrs.branch_of_service,      // Expected to be "Reserve" (or similar)
      startDate: attrs.start_date,                     // Expected to be a valid date string, e.g., "1987-12-05"
      endDate: attrs.end_date,                         // Expected to be a valid date string, e.g., "1989-12-05"
      serviceType: attrs.service_type,                 // Expected to be "Active Duty" (or similar)
      componentOfService: attrs.component_of_service,  // Expected to be "Reserves" (or similar)
      separationReason: attrs.separation_reason,       // Expected to be "UNKNOWN" (or similar)
      dischargeStatus: attrs.discharge_status,         // Expected to be "honorable-absence-of-negative-report" (or similar)
      rankAtDischarge: attrs.pay_grade,                // May be null if not provided
      mos: attrs.mos,                                  // May be null if not provided
    };

    // Log each individual field for clarity
    console.log("Mapped Insert Data:");
    console.log("  userId:", userId);
    console.log("  branchOfService:", attrs.branch_of_service);
    console.log("  startDate:", attrs.start_date);
    console.log("  endDate:", attrs.end_date);
    console.log("  serviceType:", attrs.service_type);
    console.log("  componentOfService:", attrs.component_of_service);
    console.log("  separationReason:", attrs.separation_reason);
    console.log("  dischargeStatus:", attrs.discharge_status);
    console.log("  rankAtDischarge:", attrs.pay_grade);
    console.log("  mos:", attrs.mos);
    console.log("Full mapped object:", JSON.stringify(mappedData, null, 2));

    // Insert the mapped data into the database
    await db.insert(serviceHistories).values(mappedData);
  }
}



async function storeDisabilityRatingsInDB(userId: string, disabilityData: any) {
  for (const disability of disabilityData) {
    const attrs = disability.attributes || disability;
    const insertData = {
      userId,
      name: attrs.diagnostic_type_name,  
      diagnosticCode: attrs.diagnostic_type_code,
      disabilityRating: attrs.rating_percentage,
      staticInd: attrs.static_ind,
      effectiveDate: attrs.effective_date,
    };
    console.log("Inserting disability rating record:", insertData);
    await db.insert(disabilities).values(insertData);
  }
}

