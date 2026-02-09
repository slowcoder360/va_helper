/**
 * VA API Client
 * 
 * Unified client for interacting with VA APIs with built-in token management,
 * error handling, and data mapping.
 */

import axios, { AxiosError } from "axios";
import { db } from "@/lib/db";
import { userTokens, userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logging";
import {
  TokenResponse,
  StoredToken,
  ServiceHistory,
  DisabilityRatings,
  IndividualRating,
  Claim,
  MedicalRecord,
  VAServiceHistoryResponse,
  VADisabilityRatingsResponse,
  VAClaimsResponse,
  VAMedicalRecordsResponse,
} from "@/lib/types/vaApi";

const logger = createLogger("VaApiClient");

// Token refresh buffer (refresh 5 minutes before expiration)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

class VaApiClient {
  private baseUrls: {
    serviceHistory: string;
    disabilityRatings: string;
    claims: string;
    medicalRecords: string;
  };
  private tokenUrl: string;
  private clientId: string;
  private clientSecret: string;
  // Mutex for token refresh to prevent concurrent refreshes
  private refreshPromises: Map<string, Promise<string>> = new Map();

  constructor() {
    // These URLs should be configured in environment variables
    this.baseUrls = {
      serviceHistory: process.env.VA_SERVICE_HISTORY_API_BASE_URL || "https://sandbox-api.va.gov/services/veteran_verification/v2",
      disabilityRatings: process.env.VA_DISABILITY_RATING_API_BASE_URL || "https://sandbox-api.va.gov/services/veteran_verification/v2",
      claims: process.env.VA_CLAIMS_API_BASE_URL || "https://sandbox-api.va.gov/services/claims/v2",
      medicalRecords: process.env.VA_HEALTH_API_BASE_URL || "https://sandbox-api.va.gov/services/fhir/v0/r4",
    };
    this.tokenUrl = process.env.VA_TOKEN_URL || "https://sandbox-api.va.gov/oauth2/token";
    this.clientId = process.env.VA_CLIENT_ID || "";
    this.clientSecret = process.env.VA_CLIENT_SECRET || "";
  }

  // ============================================
  // Token Management
  // ============================================

  /**
   * Get a valid access token for the user, refreshing if necessary
   */
  async getValidToken(userId: string): Promise<string> {
    logger.info("Getting valid token", { userId });

    const [tokenRecord] = await db
      .select()
      .from(userTokens)
      .where(eq(userTokens.userId, userId))
      .limit(1);

    if (!tokenRecord) {
      logger.error("No token found for user", { userId });
      throw new Error("No authentication token found. Please re-authenticate with VA.gov.");
    }

    // Check if token needs refresh
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expiresAt);
    const needsRefresh = now.getTime() > expiresAt.getTime() - TOKEN_REFRESH_BUFFER_MS;

    if (needsRefresh) {
      logger.info("Token needs refresh", { userId });
      
      if (!tokenRecord.refreshToken) {
        throw new Error("Token expired and no refresh token available. Please re-authenticate.");
      }

      // Use mutex to prevent concurrent refreshes for the same user
      const existingRefresh = this.refreshPromises.get(userId);
      if (existingRefresh) {
        logger.info("Waiting for existing token refresh", { userId });
        return existingRefresh;
      }

      const refreshPromise = this.refreshToken(userId, tokenRecord.refreshToken)
        .finally(() => {
          this.refreshPromises.delete(userId);
        });
      this.refreshPromises.set(userId, refreshPromise);
      return refreshPromise;
    }

    return tokenRecord.accessToken;
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshToken(userId: string, refreshToken: string): Promise<string> {
    logger.info("Refreshing token", { userId });

    try {
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const response = await axios.post<TokenResponse>(
        this.tokenUrl,
        params.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const tokens = response.data;
      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      // Update tokens in database
      await db
        .update(userTokens)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || refreshToken,
          expiresAt: newExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(userTokens.userId, userId));

      logger.info("Token refreshed successfully", { userId });
      return tokens.access_token;
    } catch (error) {
      logger.error("Failed to refresh token", { userId, error });
      throw new Error("Failed to refresh authentication. Please re-authenticate with VA.gov.");
    }
  }

  // ============================================
  // API Methods
  // ============================================

  /**
   * Get veteran's service history
   */
  async getServiceHistory(userId: string): Promise<ServiceHistory[]> {
    logger.info("Fetching service history", { userId });

    const accessToken = await this.getValidToken(userId);

    try {
      return await this.withRetry(async () => {
        const response = await axios.get<VAServiceHistoryResponse>(
          `${this.baseUrls.serviceHistory}/service_history`,
          {
            headers: this.getAuthHeaders(accessToken),
          }
        );

        const mapped = this.mapServiceHistory(response.data);
        logger.info("Service history fetched", { userId, count: mapped.length });
        return mapped;
      }, "service history");
    } catch (error) {
      this.handleApiError(error, "service history");
    }
  }

  /**
   * Get veteran's disability ratings
   */
  async getDisabilityRatings(userId: string): Promise<DisabilityRatings> {
    logger.info("Fetching disability ratings", { userId });

    const accessToken = await this.getValidToken(userId);

    try {
      return await this.withRetry(async () => {
        const response = await axios.get<VADisabilityRatingsResponse>(
          `${this.baseUrls.disabilityRatings}/disability_rating`,
          {
            headers: this.getAuthHeaders(accessToken),
          }
        );

        const mapped = this.mapDisabilityRatings(response.data);
        logger.info("Disability ratings fetched", { userId, combinedRating: mapped.combinedRating });
        return mapped;
      }, "disability ratings");
    } catch (error) {
      this.handleApiError(error, "disability ratings");
    }
  }

  /**
   * Get veteran's claims
   */
  async getClaims(userId: string): Promise<Claim[]> {
    logger.info("Fetching claims", { userId });

    const accessToken = await this.getValidToken(userId);

    try {
      return await this.withRetry(async () => {
        const response = await axios.get<VAClaimsResponse>(
          `${this.baseUrls.claims}/veterans/claims`,
          {
            headers: this.getAuthHeaders(accessToken),
          }
        );

        const mapped = this.mapClaims(response.data);
        logger.info("Claims fetched", { userId, count: mapped.length });
        return mapped;
      }, "claims");
    } catch (error) {
      this.handleApiError(error, "claims");
    }
  }

  /**
   * Get veteran's medical records (FHIR-based)
   */
  async getMedicalRecords(userId: string): Promise<MedicalRecord[]> {
    logger.info("Fetching medical records", { userId });

    const accessToken = await this.getValidToken(userId);

    try {
      return await this.withRetry(async () => {
        // FHIR Patient search - this endpoint may vary based on VA API implementation
        const response = await axios.get<VAMedicalRecordsResponse>(
          `${this.baseUrls.medicalRecords}/Observation`,
          {
            headers: this.getAuthHeaders(accessToken),
            params: {
              _count: 50, // Limit results
            },
          }
        );

        const mapped = this.mapMedicalRecords(response.data);
        logger.info("Medical records fetched", { userId, count: mapped.length });
        return mapped;
      }, "medical records");
    } catch (error) {
      this.handleApiError(error, "medical records");
    }
  }

  /**
   * Sync all veteran data from VA APIs
   */
  async syncAllVeteranData(userId: string): Promise<{
    serviceHistory: ServiceHistory[];
    disabilityRatings: DisabilityRatings;
    claims: Claim[];
  }> {
    logger.info("Syncing all veteran data", { userId });

    // Fetch all data in parallel
    const [serviceHistory, disabilityRatings, claims] = await Promise.all([
      this.getServiceHistory(userId).catch(err => {
        logger.warn("Failed to fetch service history", { userId, error: err.message });
        return [] as ServiceHistory[];
      }),
      this.getDisabilityRatings(userId).catch(err => {
        logger.warn("Failed to fetch disability ratings", { userId, error: err.message });
        return { combinedRating: 0, combinedEffectiveDate: "", individualRatings: [] } as DisabilityRatings;
      }),
      this.getClaims(userId).catch(err => {
        logger.warn("Failed to fetch claims", { userId, error: err.message });
        return [] as Claim[];
      }),
    ]);

    logger.info("All veteran data synced", { userId });
    return { serviceHistory, disabilityRatings, claims };
  }

  // ============================================
  // Data Mapping
  // ============================================

  private mapServiceHistory(data: VAServiceHistoryResponse): ServiceHistory[] {
    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((item) => {
      const attrs = item.attributes;
      return {
        branchOfService: attrs.branch_of_service,
        startDate: attrs.start_date,
        endDate: attrs.end_date,
        serviceType: attrs.service_type,
        dischargeStatus: attrs.character_of_discharge,
        rankAtDischarge: attrs.pay_grade,
        deployments: attrs.deployments?.map((d) => ({
          startDate: d.start_date,
          endDate: d.end_date,
          location: d.location,
        })),
      };
    });
  }

  private mapDisabilityRatings(data: VADisabilityRatingsResponse): DisabilityRatings {
    const attrs = data.data?.attributes;
    if (!attrs) {
      return {
        combinedRating: 0,
        combinedEffectiveDate: "",
        individualRatings: [],
      };
    }

    return {
      combinedRating: attrs.combined_disability_rating,
      combinedEffectiveDate: attrs.combined_effective_date,
      individualRatings: (attrs.individual_ratings || []).map((r) => ({
        name: r.diagnostic_type_name,
        diagnosticCode: r.diagnostic_type_code,
        rating: r.rating_percentage,
        isStatic: r.static_ind,
        effectiveDate: r.effective_date,
        decision: r.decision,
      })),
    };
  }

  private mapClaims(data: VAClaimsResponse): Claim[] {
    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((item) => {
      const attrs = item.attributes;
      return {
        claimId: item.id,
        claimType: attrs.claim_type,
        status: attrs.status,
        closeDate: attrs.close_date,
        contentions: attrs.contention_list || [],
        documentsNeeded: attrs.documents_needed,
        decisionLetterSent: attrs.decision_letter_sent,
      };
    });
  }

  private mapMedicalRecords(data: VAMedicalRecordsResponse): MedicalRecord[] {
    if (!data.entry || !Array.isArray(data.entry)) {
      return [];
    }

    return data.entry.map((entry) => {
      const resource = entry.resource;
      const category = resource.category?.[0]?.coding?.[0]?.display || "Unknown";
      const code = resource.code?.text || resource.code?.coding?.[0]?.display || "Unknown";
      
      let value: string | undefined;
      if (resource.valueQuantity) {
        value = `${resource.valueQuantity.value} ${resource.valueQuantity.unit}`;
      } else if (resource.valueString) {
        value = resource.valueString;
      }

      return {
        recordId: resource.id,
        recordType: resource.resourceType,
        category,
        description: code,
        date: resource.effectiveDateTime || resource.issued || "",
        provider: resource.performer?.[0]?.display,
        value,
      };
    });
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Retry a function with exponential backoff for transient errors (5xx, network)
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    context: string,
    retries = MAX_RETRIES
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const isRetryable = axios.isAxiosError(error) && (
          !error.response || // Network error
          error.response.status >= 500 || // Server error
          error.response.status === 429 // Rate limited
        );

        if (!isRetryable || attempt === retries) {
          throw error;
        }

        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        logger.warn(`Retrying ${context} (attempt ${attempt + 1}/${retries})`, {
          delay,
          error: error instanceof Error ? error.message : String(error),
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  private getAuthHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private handleApiError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data as Record<string, unknown> | undefined;

      logger.error(`VA API error: ${context}`, {
        status,
        data,
        message: axiosError.message,
      });

      if (status === 401 || status === 403) {
        throw new Error("Authentication failed. Please re-authenticate with VA.gov.");
      }

      if (status === 404) {
        throw new Error(`No ${context} found for this veteran.`);
      }

      if (status === 429) {
        throw new Error("Too many requests. Please try again later.");
      }

      if (status && status >= 500) {
        throw new Error("VA API is temporarily unavailable. Please try again later.");
      }

      throw new Error(`Failed to fetch ${context}. Please try again.`);
    }

    logger.error(`Unknown error: ${context}`, { error });
    throw new Error(`An unexpected error occurred while fetching ${context}.`);
  }
}

// Export singleton instance
export const vaApiClient = new VaApiClient();

// Export class for testing
export { VaApiClient };
