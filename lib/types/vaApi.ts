/**
 * VA API Types
 * 
 * Type definitions for VA API responses and our internal data structures.
 */

// Token types
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface StoredToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

// Service History types
export interface VAServiceHistoryResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      branch_of_service: string;
      start_date: string;
      end_date: string | null;
      service_type: string;
      character_of_discharge: string;
      pay_grade: string | null;
      deployments?: Array<{
        start_date: string;
        end_date: string;
        location: string;
      }>;
    };
  }>;
}

export interface ServiceHistory {
  branchOfService: string;
  startDate: string;
  endDate: string | null;
  serviceType: string;
  dischargeStatus: string;
  rankAtDischarge: string | null;
  deployments?: Deployment[];
}

export interface Deployment {
  startDate: string;
  endDate: string;
  location: string;
  operationName?: string;
}

// Disability Ratings types
export interface VADisabilityRatingsResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      combined_disability_rating: number;
      combined_effective_date: string;
      legal_effective_date: string;
      individual_ratings: Array<{
        decision: string;
        diagnostic_type_code: string;
        diagnostic_type_name: string;
        effective_date: string;
        rating_percentage: number;
        static_ind: boolean;
      }>;
    };
  };
}

export interface DisabilityRatings {
  combinedRating: number;
  combinedEffectiveDate: string;
  individualRatings: IndividualRating[];
}

export interface IndividualRating {
  name: string;
  diagnosticCode: string;
  rating: number;
  isStatic: boolean;
  effectiveDate: string;
  decision: string;
}

// Claims types
export interface VAClaimsResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      claim_type: string;
      claim_type_code: string;
      close_date: string | null;
      contention_list: string[];
      decision_letter_sent: boolean;
      development_letter_sent: boolean;
      documents_needed: boolean;
      end_product_code: string;
      evidence_waiver_submitted_5103: boolean;
      lighthouse_id: string;
      status: string;
      submitter_application_code: string;
      submitter_role_code: string;
    };
  }>;
}

export interface Claim {
  claimId: string;
  claimType: string;
  status: string;
  closeDate: string | null;
  contentions: string[];
  documentsNeeded: boolean;
  decisionLetterSent: boolean;
}

// Medical Records types (VA Health API)
export interface VAMedicalRecordsResponse {
  entry: Array<{
    resource: {
      resourceType: string;
      id: string;
      category?: Array<{
        coding: Array<{
          code: string;
          display: string;
        }>;
      }>;
      code?: {
        coding: Array<{
          code: string;
          display: string;
        }>;
        text: string;
      };
      effectiveDateTime?: string;
      issued?: string;
      performer?: Array<{
        reference: string;
        display: string;
      }>;
      valueQuantity?: {
        value: number;
        unit: string;
      };
      valueString?: string;
    };
  }>;
}

export interface MedicalRecord {
  recordId: string;
  recordType: string;
  category: string;
  description: string;
  date: string;
  provider?: string;
  value?: string;
}

// Error types
export interface VAApiError {
  errors: Array<{
    title: string;
    detail: string;
    code: string;
    status: string;
  }>;
}

// Generic response wrapper
export interface VAApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
