# VA API Client Implementation Plan

## 1. Core Client Structure

```typescript
// lib/services/vaApiClient.ts
import { db } from '@/lib/db';
import { userTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';

class VaApiClient {
  private baseUrl: string;
  private tokenUrl: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.baseUrl = process.env.VA_SERVICE_HISTORY_API_BASE_URL!;
    this.tokenUrl = process.env.VA_TOKEN_URL!;
    this.clientId = process.env.VA_SERVICE_HISTORY_CLIENT_ID!;
    this.clientSecret = process.env.VA_SERVICE_HISTORY_CLIENT_SECRET!;
  }

  // Token Management
  private async getValidToken(userId: string): Promise<string> {
    // Get tokens from database
    // Check expiration
    // Refresh if needed
    // Return valid token
  }

  private async refreshToken(refreshToken: string): Promise<TokenResponse> {
    // Exchange refresh token for new access token
    // Update database
    // Return new tokens
  }

  // API Endpoints
  async getServiceHistory(userId: string): Promise<ServiceHistory[]> {
    // Get valid token
    // Make API call
    // Map response data
    // Return mapped data
  }

  async getDisabilityRatings(userId: string): Promise<DisabilityRatings> {
    // Get valid token
    // Make API call
    // Map response data
    // Return mapped data
  }

  async getMedicalRecords(userId: string): Promise<MedicalRecord[]> {
    // Get valid token
    // Make API call
    // Map response data
    // Return mapped data
  }

  async getClaims(userId: string): Promise<Claim[]> {
    // Get valid token
    // Make API call
    // Map response data
    // Return mapped data
  }

  // Data Mapping
  private mapServiceHistory(data: any): ServiceHistory[] {
    // Map VA API response to our schema
  }

  private mapDisabilityRatings(data: any): DisabilityRatings {
    // Map VA API response to our schema
  }

  private mapMedicalRecords(data: any): MedicalRecord[] {
    // Map VA API response to our schema
  }

  private mapClaims(data: any): Claim[] {
    // Map VA API response to our schema
  }

  // Error Handling
  private handleApiError(error: any): never {
    // Handle different types of errors
    // Log errors
    // Throw appropriate error
  }
}
```

## 2. Types and Interfaces

```typescript
// lib/types/vaApi.ts
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface ServiceHistory {
  branchOfService: string;
  startDate: string;
  endDate: string | null;
  serviceType: string;
  componentOfService: string;
  separationReason: string;
  dischargeStatus: string;
  rankAtDischarge: string | null;
  mos: string | null;
}

interface DisabilityRatings {
  combinedRating: number;
  individualRatings: IndividualRating[];
}

interface IndividualRating {
  name: string;
  diagnosticCode: string;
  rating: number;
  static: boolean;
  effectiveDate: string;
}

interface MedicalRecord {
  recordId: string;
  recordType: string;
  facility: string;
  visitDate: string;
  provider: string;
  diagnosis: string | null;
  treatment: string | null;
}

interface Claim {
  claimId: string;
  claimType: string;
  claimStatus: string;
  dateSubmitted: string;
  decision: string | null;
  lastUpdated: string;
}
```

## 3. Implementation Phases

### Phase 1: Core Client Setup
1. Create base client class
2. Implement token management
3. Add error handling
4. Set up logging

### Phase 2: Service History Integration
1. Implement getServiceHistory method
2. Create data mapping
3. Add error handling specific to service history
4. Test with sandbox API

### Phase 3: Disability Ratings Integration
1. Implement getDisabilityRatings method
2. Create data mapping
3. Add error handling specific to disability ratings
4. Test with sandbox API

### Phase 4: Medical Records Integration
1. Implement getMedicalRecords method
2. Create data mapping
3. Add error handling specific to medical records
4. Test with sandbox API

### Phase 5: Claims Integration
1. Implement getClaims method
2. Create data mapping
3. Add error handling specific to claims
4. Test with sandbox API

## 4. Testing Strategy

### Unit Tests
1. Token Management
   - Token retrieval
   - Token refresh
   - Token expiration

2. API Calls
   - Service history
   - Disability ratings
   - Medical records
   - Claims

3. Data Mapping
   - Service history mapping
   - Disability ratings mapping
   - Medical records mapping
   - Claims mapping

### Integration Tests
1. End-to-end flow
   - OAuth -> Token -> API Call -> Data Storage
2. Error scenarios
   - Invalid tokens
   - API errors
   - Network issues

## 5. Error Handling Strategy

### Token Errors
- Invalid token
- Expired token
- Refresh token failure

### API Errors
- Rate limiting
- Invalid requests
- Server errors
- Network issues

### Data Errors
- Invalid response format
- Missing required fields
- Type mismatches

## 6. Logging Strategy

### Log Levels
- DEBUG: Detailed API interactions
- INFO: Successful operations
- WARN: Non-critical issues
- ERROR: Critical failures

### Log Data
- API endpoints called
- Response status codes
- Error details
- Token operations
- Data mapping results

## 7. Next Steps
1. Create base client class
2. Implement token management
3. Add service history integration
4. Add testing infrastructure
5. Implement remaining endpoints 