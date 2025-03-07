// lib/services/storeData.ts

import { db } from "@/lib/db";
import { serviceHistories, deployments, disabilities } from "@/lib/db/schema";

export async function storeServiceHistoryInDB(userId: string, serviceHistoryData: any) {
  for (const history of serviceHistoryData) {
    const newServiceHistory = {
      userId,
      branchOfService: history.branchOfService,
      startDate: history.startDate,
      endDate: history.endDate,
      serviceType: history.serviceType,
      componentOfService: history.componentOfService,
      separationReason: history.separationReason,
      dischargeStatus: history.dischargeStatus,
      rankAtDischarge: history.rankAtDischarge,
      mos: history.mos,
    };

    const serviceHistory = await db.insert(serviceHistories).values(newServiceHistory).returning();

    // Store deployments if available
    if (history.deployments) {
      for (const deployment of history.deployments) {
        const newDeployment = {
          serviceHistoryId: serviceHistory[0].serviceHistoryId,
          location: deployment.location,
          startDate: deployment.startDate,
          endDate: deployment.endDate,
          operationName: deployment.operationName,
          serviceType: deployment.serviceType,
        };
        await db.insert(deployments).values(newDeployment);
      }
    }
  }
}

export async function storeDisabilitiesInDB(userId: string, disabilitiesData: any) {
  for (const disability of disabilitiesData) {
    const newDisability = {
      userId,
      name: disability.name,
      diagnosticCode: disability.diagnosticCode,
      disabilityRating: disability.ratingPercentage,
      staticInd: disability.staticInd,
      effectiveDate: disability.effectiveDate,
    };

    await db.insert(disabilities).values(newDisability);
  }
}
