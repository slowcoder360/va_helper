# Schema Update Plan

## 1. Update Existing Tables

### userProfiles
```typescript
// Add new fields
export const userProfiles = pgTable("user_profiles", {
  // ... existing fields ...
  vaFileNumber: varchar("va_file_number", { length: 256 }), // VA File Number
  vaEligibilityStatus: varchar("va_eligibility_status", { length: 256 }), // VA Eligibility Status
  vaEnrollmentStatus: varchar("va_enrollment_status", { length: 256 }), // VA Healthcare Enrollment Status
  vaFacility: varchar("va_facility", { length: 256 }), // Primary VA Facility
  vaBenefitsStartDate: date("va_benefits_start_date"), // When VA benefits began
  vaLastUpdate: timestamp("va_last_update"), // Last VA data sync
  vaData: jsonb("va_data").default({}), // Store additional VA data as JSON
});
```

### claims
```typescript
// Add new fields
export const claims = pgTable("claims", {
  // ... existing fields ...
  vaClaimId: varchar("va_claim_id", { length: 256 }), // VA's internal claim ID
  vaClaimType: varchar("va_claim_type", { length: 256 }), // VA's claim type classification
  vaClaimStatus: varchar("va_claim_status", { length: 256 }), // VA's status
  vaClaimPhase: varchar("va_claim_phase", { length: 256 }), // Current phase in VA system
  vaEstimatedCompletionDate: date("va_estimated_completion_date"), // VA's estimated completion
  vaLastUpdated: timestamp("va_last_updated"), // Last update from VA
  vaData: jsonb("va_data").default({}), // Additional VA claim data
});
```

### appeals
```typescript
// Add new fields
export const appeals = pgTable("appeals", {
  // ... existing fields ...
  vaAppealId: varchar("va_appeal_id", { length: 256 }), // VA's internal appeal ID
  vaDocketNumber: varchar("va_docket_number", { length: 256 }), // VA docket number
  vaRegionalOffice: varchar("va_regional_office", { length: 256 }), // Handling RO
  vaEvidenceWindowEnd: date("va_evidence_window_end"), // Evidence submission deadline
  vaHearingRequested: boolean("va_hearing_requested"), // Whether hearing was requested
  vaHearingDate: date("va_hearing_date"), // Scheduled hearing date
  vaData: jsonb("va_data").default({}), // Additional VA appeal data
});
```

## 2. Add New Tables

### vaServiceHistory
```typescript
export const vaServiceHistory = pgTable("va_service_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }),
  vaServiceId: varchar("va_service_id", { length: 256 }).notNull(), // VA's service ID
  branch: varchar("branch", { length: 256 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  serviceType: varchar("service_type", { length: 256 }),
  component: varchar("component", { length: 256 }),
  dischargeType: varchar("discharge_type", { length: 256 }),
  rank: varchar("rank", { length: 256 }),
  mos: varchar("mos", { length: 256 }),
  vaData: jsonb("va_data").default({}),
  lastSynced: timestamp("last_synced").defaultNow(),
});
```

### vaDisabilityRatings
```typescript
export const vaDisabilityRatings = pgTable("va_disability_ratings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }),
  vaRatingId: varchar("va_rating_id", { length: 256 }).notNull(),
  diagnosticCode: varchar("diagnostic_code", { length: 256 }).notNull(),
  description: text("description").notNull(),
  rating: integer("rating").notNull(),
  effectiveDate: date("effective_date").notNull(),
  endDate: date("end_date"),
  isPermanent: boolean("is_permanent"),
  vaData: jsonb("va_data").default({}),
  lastSynced: timestamp("last_synced").defaultNow(),
});
```

### vaMedicalRecords
```typescript
export const vaMedicalRecords = pgTable("va_medical_records", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }),
  vaRecordId: varchar("va_record_id", { length: 256 }).notNull(),
  recordType: varchar("record_type", { length: 256 }).notNull(),
  facility: varchar("facility", { length: 256 }).notNull(),
  visitDate: date("visit_date").notNull(),
  provider: varchar("provider", { length: 256 }),
  diagnosis: text("diagnosis"),
  treatment: text("treatment"),
  vaData: jsonb("va_data").default({}),
  lastSynced: timestamp("last_synced").defaultNow(),
});
```

### vaAppealEvidence
```typescript
export const vaAppealEvidence = pgTable("va_appeal_evidence", {
  id: serial("id").primaryKey(),
  appealId: integer("appeal_id")
    .notNull()
    .references(() => appeals.appealId, { onDelete: "cascade" }),
  vaEvidenceId: varchar("va_evidence_id", { length: 256 }).notNull(),
  evidenceType: varchar("evidence_type", { length: 256 }).notNull(),
  description: text("description").notNull(),
  submittedDate: date("submitted_date").notNull(),
  receivedDate: date("received_date"),
  status: varchar("status", { length: 256 }).notNull(),
  vaData: jsonb("va_data").default({}),
  lastSynced: timestamp("last_synced").defaultNow(),
});
```

### vaAppealHearings
```typescript
export const vaAppealHearings = pgTable("va_appeal_hearings", {
  id: serial("id").primaryKey(),
  appealId: integer("appeal_id")
    .notNull()
    .references(() => appeals.appealId, { onDelete: "cascade" }),
  vaHearingId: varchar("va_hearing_id", { length: 256 }).notNull(),
  hearingType: varchar("hearing_type", { length: 256 }).notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  location: varchar("location", { length: 256 }).notNull(),
  status: varchar("status", { length: 256 }).notNull(),
  judge: varchar("judge", { length: 256 }),
  notes: text("notes"),
  vaData: jsonb("va_data").default({}),
  lastSynced: timestamp("last_synced").defaultNow(),
});
```

## 3. Update Relationships

### Add to claims
```typescript
// Add relationship to vaServiceHistory
serviceHistoryId: integer("service_history_id")
  .references(() => vaServiceHistory.id)
  .notNull(),
```

### Add to appeals
```typescript
// Add relationship to claims
claimId: integer("claim_id")
  .references(() => claims.claimId)
  .notNull(),
```

## 4. Migration Strategy

1. **Phase 1: Add New Fields**
   - Add new fields to existing tables
   - Make all new fields nullable initially
   - Update existing records with default values

2. **Phase 2: Create New Tables**
   - Create new tables with relationships
   - Set up foreign key constraints
   - Initialize with empty data

3. **Phase 3: Data Migration**
   - Migrate existing data to new structure
   - Update relationships
   - Validate data integrity

4. **Phase 4: API Updates**
   - Update API endpoints to handle new fields
   - Add new endpoints for new tables
   - Update data validation

## 5. Implementation Order

1. Update existing tables with new fields
2. Create new tables
3. Update relationships
4. Create migration scripts
5. Update API endpoints
6. Test data integrity
7. Deploy changes

## 6. Testing Plan

1. **Unit Tests**
   - Test new field validations
   - Test new table relationships
   - Test data migrations

2. **Integration Tests**
   - Test API endpoints with new fields
   - Test data flow between tables
   - Test VA data synchronization

3. **Data Validation**
   - Verify data integrity
   - Check relationship constraints
   - Validate VA data format 