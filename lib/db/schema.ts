// db/schema.ts

import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  date,
  boolean,
} from "drizzle-orm/pg-core";
import { InferModel } from "drizzle-orm";

// Enum for user system roles
export const userSystemEnum = pgEnum("user_system_enum", ["system", "user"]);

// User Profiles Table
export const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id", { length: 256 }).primaryKey(),
  ssn: varchar("ssn", { length: 11 }).notNull(),
  firstName: varchar("first_name", { length: 256 }).notNull(),
  lastName: varchar("last_name", { length: 256 }).notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  email: varchar("email", { length: 256 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }), // Optional
  street: text("street"), // Optional
  city: varchar("city", { length: 256 }), // Optional
  state: varchar("state", { length: 2 }), // Optional
  zipCode: varchar("zip_code", { length: 10 }), // Optional
  combinedDisabilityRating: integer("combined_disability_rating"), // Optional
  dischargeStatus: varchar("discharge_status", { length: 256 }), // Optional
  veteranStatus: varchar("veteran_status", { length: 256 }), // CONFIRMED, NOT CONFIRMED
});

// User Tokens Table
export const userTokens = pgTable("user_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"), // Optional
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Service Histories Table
export const serviceHistories = pgTable("service_histories", {
  serviceHistoryId: serial("service_history_id").primaryKey(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }),
  branchOfService: varchar("branch_of_service", { length: 256 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // Optional if currently serving
  serviceType: varchar("service_type", { length: 256 }), // e.g., Active Duty
  componentOfService: varchar("component_of_service", { length: 256 }), // e.g., Reserves
  separationReason: varchar("separation_reason", { length: 256 }), // Reason for separation
  dischargeStatus: varchar("discharge_status", { length: 256 }), // Optional
  rankAtDischarge: varchar("rank_at_discharge", { length: 256 }), // Optional
  mos: varchar("mos", { length: 256 }), // Military Occupational Specialty, Optional
});

// Deployments Table
export const deployments = pgTable("deployments", {
  deploymentId: serial("deployment_id").primaryKey(),
  serviceHistoryId: integer("service_history_id")
    .notNull()
    .references(() => serviceHistories.serviceHistoryId, { onDelete: "cascade" }),
  location: varchar("location", { length: 256 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  operationName: varchar("operation_name", { length: 256 }), // Optional
  serviceType: varchar("service_type", { length: 256 }), // Optional, distinguishes different deployment types
});

// Disabilities Table
export const disabilities = pgTable("disabilities", {
  disabilityId: serial("disability_id").primaryKey(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }),
  name: varchar("name", { length: 256 }).notNull(),
  diagnosticCode: varchar("diagnostic_code", { length: 256 }), // Optional
  disabilityRating: integer("disability_rating").notNull(),
  staticInd: boolean("static_ind"), // Indicates if the condition is permanent
  effectiveDate: date("effective_date").notNull(),
});

// Chats Table
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  pdfName: text("pdf_name").notNull(),
  pdfUrl: text("pdf_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }), // Cascade delete on userProfile deletion
  fileKey: text("file_key").notNull(),
});

export type DrizzleChat = typeof chats.$inferSelect;

// Messages Table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id")
    .references(() => chats.id, { onDelete: "cascade" }) // Cascade delete on chat deletion
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  role: userSystemEnum("role").notNull(),
});

// Claim Chats Table
export const claimChats = pgTable("claim_chats", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }), // Cascade delete on userProfile deletion
  claimType: varchar("claim_type", { length: 100 }), // Optional until user specifies
  status: varchar("status", { length: 50 }).default("in_progress"), // Track claim status
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


// Claim Messages Table
export const claimMessages = pgTable("claim_messages", {
  id: serial("id").primaryKey(),
  claimChatId: integer("claim_chat_id")
    .references(() => claimChats.id, { onDelete: "cascade" }) // Cascade delete on claim chat deletion
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  role: userSystemEnum("role").notNull(), // Enum to differentiate user vs. system messages
});

// Claims Table
export const claims = pgTable("claims", {
  claimId: serial("claim_id").primaryKey(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }),
  serviceHistoryId: integer("service_history_id").references(
    () => serviceHistories.serviceHistoryId
  ), // Optional
  claimType: varchar("claim_type", { length: 256 }).notNull(),
  claimStatus: varchar("claim_status", { length: 256 }).notNull(),
  dateSubmitted: timestamp("date_submitted").notNull(),
  claimDecision: varchar("claim_decision", { length: 256 }), // Optional
  dateOfLastUpdate: timestamp("date_of_last_update").notNull(),
});

// Claim Documents Table
export const claimDocuments = pgTable("claim_documents", {
  documentId: serial("document_id").primaryKey(),
  claimId: integer("claim_id")
    .references(() => claims.claimId, { onDelete: "cascade" }) // Cascade delete on claim deletion
    .notNull(),
  documentType: varchar("document_type", { length: 256 }).notNull(),
  dateSubmitted: timestamp("date_submitted").notNull(),
  description: text("description"), // Optional
});

// Appeals Table
export const appeals = pgTable("appeals", {
  appealId: serial("appeal_id").primaryKey(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }), // Cascade delete on userProfile deletion
  appealType: varchar("appeal_type", { length: 256 }).notNull(),
  appealStatus: varchar("appeal_status", { length: 256 }).notNull(),
  dateFiled: timestamp("date_filed").notNull(),
  lastUpdated: timestamp("last_updated").notNull(),
  assignedVeteranLawJudge: varchar("assigned_veteran_law_judge", { length: 256 }), // Optional
  appealStage: varchar("appeal_stage", { length: 256 }), // Optional
});

// Appeal Issues Table
export const appealIssues = pgTable("appeal_issues", {
  issueId: serial("issue_id").primaryKey(),
  appealId: integer("appeal_id")
    .references(() => appeals.appealId, { onDelete: "cascade" }) // Cascade delete on appeal deletion
    .notNull(),
  issueDescription: text("issue_description").notNull(),
  issueStatus: varchar("issue_status", { length: 256 }).notNull(),
});

// Appeal Events Table
export const appealEvents = pgTable("appeal_events", {
  eventId: serial("event_id").primaryKey(),
  appealId: integer("appeal_id")
    .references(() => appeals.appealId, { onDelete: "cascade" }) // Cascade delete on appeal deletion
    .notNull(),
  eventType: varchar("event_type", { length: 256 }).notNull(),
  eventDate: timestamp("event_date").notNull(),
  eventDetails: text("event_details"), // Optional
});

// Document Uploads Table
export const documentUploads = pgTable("document_uploads", {
  requestId: serial("request_id").primaryKey(),
  userId: varchar("user_id", { length: 256 })
    .notNull()
    .references(() => userProfiles.userId, { onDelete: "cascade" }), // Cascade delete on userProfile deletion
  participantId: integer("participant_id").notNull(),
  fileNumber: varchar("file_number", { length: 256 }).notNull(),
  claimId: integer("claim_id").references(() => claims.claimId), // Optional relation with claims table
  docType: varchar("doc_type", { length: 256 }).notNull(),
  fileName: varchar("file_name", { length: 256 }).notNull(),
  trackedItemIds: text("tracked_item_ids").array(), // Optional array of tracked items
  uploadStatus: varchar("upload_status", { length: 256 }).notNull(),
  uploadedDateTime: timestamp("uploaded_date_time").notNull(),
});