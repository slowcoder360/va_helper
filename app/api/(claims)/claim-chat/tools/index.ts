/**
 * Claim Chat Tools
 * 
 * Tools available to the claim chat assistant for retrieving
 * veteran data, regulations, and claim status.
 * 
 * PRIVACY DESIGN:
 * - Veteran profile tool returns ANONYMIZED data (no PII)
 * - Search tools use HyDE (Hypothetical Document Embeddings)
 * - Personal details never sent to third-party APIs
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { createLogger } from "@/lib/logging";
import { db } from "@/lib/db";
import { 
  userProfiles, 
  serviceHistories, 
  disabilities, 
  claims,
  veteranProfiles 
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { searchVAKnowledgePrivate, searchCFRPart, searchByCondition } from "@/lib/context";

const logger = createLogger('ClaimChatTools');

/**
 * Get veteran profile from the database - ANONYMIZED
 * Returns only claims-relevant data, no PII
 */
export const getVeteranProfileTool = new DynamicStructuredTool({
  name: "get_veteran_profile",
  description: "Retrieve the veteran's claims-relevant information (service branch, discharge status, current conditions and ratings). Does NOT include personal identifiers. Use when you need to understand their situation for claims guidance.",
  schema: z.object({
    userId: z.string().describe("The user ID of the veteran"),
  }),
  func: async ({ userId }) => {
    try {
      logger.info("Retrieving anonymized veteran profile", { userId });
      
      // Get user profile
      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);
      
      if (!profile) {
        return JSON.stringify({ 
          success: false, 
          error: "Veteran profile not found. The veteran may need to complete their profile." 
        });
      }
      
      // Get service histories
      const services = await db
        .select()
        .from(serviceHistories)
        .where(eq(serviceHistories.userId, userId));
      
      // Get disabilities
      const disabilityRecords = await db
        .select()
        .from(disabilities)
        .where(eq(disabilities.userId, userId));
      
      logger.info("Veteran profile retrieved (anonymized)", { 
        userId, 
        hasServices: services.length > 0,
        hasDisabilities: disabilityRecords.length > 0
      });
      
      // Return ONLY claims-relevant data - NO PII
      return JSON.stringify({
        success: true,
        // Note: This is anonymized data for claims guidance
        claimsContext: {
          combinedRating: profile.combinedDisabilityRating,
          dischargeStatus: profile.dischargeStatus,
          // Service info - only branch and character of discharge (affects eligibility)
          service: services.map(s => ({
            branch: s.branchOfService,
            serviceType: s.serviceType,
            dischargeCharacter: s.separationReason,
            // No dates, names, ranks, or locations
          })),
          // Current conditions - needed to understand potential secondary claims
          conditions: disabilityRecords.map(d => ({
            condition: d.name,
            currentRating: d.disabilityRating,
            diagnosticCode: d.diagnosticCode,
            isPermanent: d.staticInd,
            // No effective dates or personal identifiers
          })),
        }
      });
    } catch (error) {
      logger.error("Error retrieving veteran profile", { 
        userId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return JSON.stringify({ 
        success: false, 
        error: "Failed to retrieve veteran profile. Please try again." 
      });
    }
  }
});

/**
 * Search VA regulations using privacy-preserving vector search
 * Uses HyDE - user query is NOT sent to embedding API
 */
export const searchRegulationsTool = new DynamicStructuredTool({
  name: "search_va_regulations",
  description: "Search VA regulations (38 CFR) for rating criteria, eligibility requirements, or claims procedures. Searches are privacy-preserving (no personal data sent to search APIs). Use when you need to cite specific regulations.",
  schema: z.object({
    query: z.string().describe("What regulation or criteria to search for (e.g., 'PTSD rating criteria', 'hearing loss diagnostic code')"),
    part: z.string().optional().describe("Optional: specific CFR part to search (e.g., '4' for rating schedule, '3' for claims procedures)"),
  }),
  func: async ({ query, part }) => {
    try {
      logger.info("Searching VA regulations (privacy-preserving)", { query, part });
      
      // Use privacy-preserving search - generates hypothetical document first
      const matches = part 
        ? await searchCFRPart(part, query)
        : await searchVAKnowledgePrivate(query, { topK: 5 });
      
      if (matches.length === 0) {
        return JSON.stringify({
          success: true,
          message: "No matching regulations found for this query.",
          results: []
        });
      }
      
      logger.info("Found regulation matches", { count: matches.length });
      
      return JSON.stringify({
        success: true,
        results: matches.map(m => ({
          citation: m.metadata.cfr_identifier,
          hierarchy: m.metadata.hierarchy,
          content: m.metadata.text,
          // Include cross-references for fuller understanding
          references: m.metadata.references_cfr?.slice(0, 3),
          conditions: m.metadata.conditions,
          diagnosticCodes: m.metadata.diagnostic_codes,
          relevance: m.score,
        }))
      });
    } catch (error) {
      logger.error("Error searching regulations", { 
        query, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return JSON.stringify({ 
        success: false, 
        error: "Failed to search regulations. The knowledge base may not be indexed yet." 
      });
    }
  }
});

/**
 * Get claim status
 */
export const getClaimStatusTool = new DynamicStructuredTool({
  name: "get_claim_status",
  description: "Retrieve the status of the veteran's existing VA claims. Use this when the veteran asks about their claim status or history.",
  schema: z.object({
    userId: z.string().describe("The user ID of the veteran"),
  }),
  func: async ({ userId }) => {
    try {
      logger.info("Retrieving claim status", { userId });
      
      const userClaims = await db
        .select()
        .from(claims)
        .where(eq(claims.userId, userId));
      
      if (userClaims.length === 0) {
        return JSON.stringify({
          success: true,
          message: "No claims found for this veteran.",
          claims: []
        });
      }
      
      logger.info("Retrieved claims", { userId, count: userClaims.length });
      
      return JSON.stringify({
        success: true,
        claims: userClaims.map(c => ({
          claimId: c.claimId,
          type: c.claimType,
          status: c.claimStatus,
          dateSubmitted: c.dateSubmitted,
          lastUpdate: c.dateOfLastUpdate,
          decision: c.claimDecision,
        }))
      });
    } catch (error) {
      logger.error("Error retrieving claim status", { 
        userId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return JSON.stringify({ 
        success: false, 
        error: "Failed to retrieve claim status." 
      });
    }
  }
});

/**
 * Search VA knowledge base - privacy-preserving
 */
export const searchVAKnowledgeTool = new DynamicStructuredTool({
  name: "search_va_knowledge",
  description: "Search the VA knowledge base for general information about claims processes, forms, procedures, and API capabilities. Privacy-preserving search.",
  schema: z.object({
    query: z.string().describe("What information to search for"),
  }),
  func: async ({ query }) => {
    try {
      logger.info("Searching VA knowledge base (privacy-preserving)", { query });
      
      const matches = await searchVAKnowledgePrivate(query, { topK: 5 });
      
      if (matches.length === 0) {
        return JSON.stringify({
          success: true,
          message: "No matching information found.",
          results: []
        });
      }
      
      return JSON.stringify({
        success: true,
        results: matches.map(m => ({
          source: m.metadata.source,
          type: m.metadata.document_type,
          citation: m.metadata.cfr_identifier,
          content: m.metadata.text,
          relevance: m.score,
        }))
      });
    } catch (error) {
      logger.error("Error searching VA knowledge", { 
        query, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return JSON.stringify({ 
        success: false, 
        error: "Failed to search knowledge base." 
      });
    }
  }
});

/**
 * Search by medical condition - optimized for condition-specific queries
 */
export const searchByConditionTool = new DynamicStructuredTool({
  name: "search_condition_criteria",
  description: "Search for rating criteria for a specific medical condition (e.g., PTSD, tinnitus, sleep apnea). Returns regulations that mention the condition and related diagnostic codes.",
  schema: z.object({
    condition: z.string().describe("The medical condition to search for (e.g., 'PTSD', 'hearing loss', 'back pain')"),
  }),
  func: async ({ condition }) => {
    try {
      logger.info("Searching by condition", { condition });
      
      const matches = await searchByCondition(condition);
      
      if (matches.length === 0) {
        return JSON.stringify({
          success: true,
          message: `No specific regulations found for ${condition}. Try using search_va_regulations with a broader query.`,
          results: []
        });
      }
      
      return JSON.stringify({
        success: true,
        condition,
        results: matches.map(m => ({
          citation: m.metadata.cfr_identifier,
          hierarchy: m.metadata.hierarchy,
          diagnosticCodes: m.metadata.diagnostic_codes,
          ratingPercentages: m.metadata.rating_percentages,
          content: m.metadata.text,
          relatedConditions: m.metadata.conditions,
        }))
      });
    } catch (error) {
      logger.error("Error searching by condition", { 
        condition, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return JSON.stringify({ 
        success: false, 
        error: "Failed to search condition criteria." 
      });
    }
  }
});

/**
 * Calculate VA Combined Rating
 * 
 * VA uses "whole person" theory - not simple addition.
 * Each rating is applied to remaining "healthy" percentage.
 * 
 * Example: 50% + 30% + 20%
 * - Start: 100% healthy
 * - 50% rating → 50% remaining healthy
 * - 30% of 50% = 15% → 35% remaining healthy  
 * - 20% of 35% = 7% → 28% remaining healthy
 * - Combined = 100 - 28 = 72% → rounds to 70%
 */
export const calculateCombinedRatingTool = new DynamicStructuredTool({
  name: "calculate_combined_rating",
  description: "Calculate VA combined disability rating using VA math (whole person theory). Input individual ratings, get combined rating. Use when veteran asks about combined rating or wants to know impact of adding a new condition.",
  schema: z.object({
    ratings: z.array(z.number().min(0).max(100)).describe("Array of individual disability ratings (e.g., [50, 30, 20])"),
    includeBilateralFactor: z.boolean().optional().describe("Whether to apply bilateral factor (10% boost for paired limb conditions)"),
    bilateralRatings: z.array(z.number()).optional().describe("Ratings that qualify for bilateral factor (paired limbs like both knees)"),
  }),
  func: async ({ ratings, includeBilateralFactor = false, bilateralRatings = [] }) => {
    try {
      if (ratings.length === 0) {
        return JSON.stringify({
          success: false,
          error: "No ratings provided. Please provide at least one rating."
        });
      }

      // Validate ratings are in 10% increments (VA standard)
      const invalidRatings = ratings.filter(r => r % 10 !== 0 && r !== 0);
      if (invalidRatings.length > 0) {
        logger.warn("Non-standard ratings provided", { invalidRatings });
      }

      // Sort ratings highest to lowest (order matters for display, not calculation)
      const sortedRatings = [...ratings].sort((a, b) => b - a);
      
      // Calculate step by step for explanation
      const steps: Array<{ rating: number; remainingHealthy: number; combined: number }> = [];
      let remainingHealthy = 100;
      
      for (const rating of sortedRatings) {
        const disability = (rating / 100) * remainingHealthy;
        remainingHealthy -= disability;
        const combined = 100 - remainingHealthy;
        steps.push({
          rating,
          remainingHealthy: Math.round(remainingHealthy * 100) / 100,
          combined: Math.round(combined * 100) / 100,
        });
      }
      
      // Exact combined (before rounding)
      const exactCombined = 100 - remainingHealthy;
      
      // Apply bilateral factor if applicable
      let bilateralBonus = 0;
      if (includeBilateralFactor && bilateralRatings.length >= 2) {
        // Bilateral factor: combine bilateral ratings, multiply by 10%
        let bilateralRemaining = 100;
        for (const br of bilateralRatings.sort((a, b) => b - a)) {
          bilateralRemaining -= (br / 100) * bilateralRemaining;
        }
        const bilateralCombined = 100 - bilateralRemaining;
        bilateralBonus = bilateralCombined * 0.10;
      }
      
      const adjustedCombined = exactCombined + bilateralBonus;
      
      // VA rounds to nearest 10% (0.5 rounds up)
      // Actually VA rounds: 0-4 down, 5-9 up
      const roundedCombined = Math.round(adjustedCombined / 10) * 10;
      
      logger.info("Calculated combined rating", { 
        inputRatings: ratings,
        exactCombined,
        bilateralBonus,
        roundedCombined
      });
      
      return JSON.stringify({
        success: true,
        calculation: {
          inputRatings: sortedRatings,
          steps: steps.map((s, i) => ({
            step: i + 1,
            rating: s.rating,
            explanation: i === 0 
              ? `${s.rating}% disability leaves ${s.remainingHealthy}% healthy`
              : `${s.rating}% of ${steps[i-1].remainingHealthy}% = ${(s.rating/100 * steps[i-1].remainingHealthy).toFixed(1)}% additional disability`,
            runningCombined: s.combined,
          })),
          exactCombined: Math.round(exactCombined * 10) / 10,
          bilateralFactor: bilateralBonus > 0 ? {
            applied: true,
            bonus: Math.round(bilateralBonus * 10) / 10,
            adjusted: Math.round(adjustedCombined * 10) / 10,
          } : null,
          finalRating: roundedCombined,
          explanation: `VA combined rating: ${sortedRatings.join('% + ')}% = ${exactCombined.toFixed(1)}%${bilateralBonus > 0 ? ` + ${bilateralBonus.toFixed(1)}% bilateral` : ''} → rounds to ${roundedCombined}%`,
        }
      });
    } catch (error) {
      logger.error("Error calculating combined rating", { 
        ratings, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return JSON.stringify({ 
        success: false, 
        error: "Failed to calculate combined rating." 
      });
    }
  }
});

/**
 * Estimate rating impact - what would adding a new condition do?
 */
export const estimateRatingImpactTool = new DynamicStructuredTool({
  name: "estimate_rating_impact",
  description: "Estimate how adding a new disability rating would affect combined rating. Shows 'what if' scenarios for different rating levels.",
  schema: z.object({
    currentRatings: z.array(z.number()).describe("Current individual ratings"),
    potentialRatings: z.array(z.number()).optional().describe("Potential new rating levels to model (default: [10, 20, 30, 50])"),
  }),
  func: async ({ currentRatings, potentialRatings = [10, 20, 30, 50] }) => {
    try {
      // Calculate current combined
      const calcCombined = (ratings: number[]): number => {
        let remaining = 100;
        for (const r of ratings.sort((a, b) => b - a)) {
          remaining -= (r / 100) * remaining;
        }
        return Math.round((100 - remaining) / 10) * 10;
      };
      
      const currentCombined = calcCombined(currentRatings);
      
      // Calculate scenarios
      const scenarios = potentialRatings.map(newRating => {
        const newCombined = calcCombined([...currentRatings, newRating]);
        const increase = newCombined - currentCombined;
        return {
          addedRating: newRating,
          newCombined,
          increaseFromCurrent: increase,
          note: increase > 0 
            ? `+${increase}% increase` 
            : increase === 0 
              ? "No change (absorbed by rounding)" 
              : "Unusual - verify ratings",
        };
      });
      
      return JSON.stringify({
        success: true,
        currentCombined,
        scenarios,
        explanation: `Currently at ${currentCombined}%. Adding ratings would result in: ${scenarios.map(s => `${s.addedRating}%→${s.newCombined}%`).join(', ')}`,
      });
    } catch (error) {
      logger.error("Error estimating rating impact", { error });
      return JSON.stringify({ success: false, error: "Failed to estimate impact." });
    }
  }
});

// Export all tools as an array
export const claimChatTools = [
  getVeteranProfileTool,
  searchRegulationsTool,
  getClaimStatusTool,
  searchVAKnowledgeTool,
  searchByConditionTool,
  calculateCombinedRatingTool,
  estimateRatingImpactTool,
];
