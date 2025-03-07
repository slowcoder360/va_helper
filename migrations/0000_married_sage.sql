DO $$ BEGIN
 CREATE TYPE "public"."user_system_enum" AS ENUM('system', 'user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appeal_events" (
	"event_id" serial PRIMARY KEY NOT NULL,
	"appeal_id" integer NOT NULL,
	"event_type" varchar(256) NOT NULL,
	"event_date" timestamp NOT NULL,
	"event_details" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appeal_issues" (
	"issue_id" serial PRIMARY KEY NOT NULL,
	"appeal_id" integer NOT NULL,
	"issue_description" text NOT NULL,
	"issue_status" varchar(256) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appeals" (
	"appeal_id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"appeal_type" varchar(256) NOT NULL,
	"appeal_status" varchar(256) NOT NULL,
	"date_filed" timestamp NOT NULL,
	"last_updated" timestamp NOT NULL,
	"assigned_veteran_law_judge" varchar(256),
	"appeal_stage" varchar(256)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"pdf_name" text NOT NULL,
	"pdf_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"file_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claim_documents" (
	"document_id" serial PRIMARY KEY NOT NULL,
	"claim_id" integer NOT NULL,
	"document_type" varchar(256) NOT NULL,
	"date_submitted" timestamp NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claims" (
	"claim_id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"service_history_id" integer,
	"claim_type" varchar(256) NOT NULL,
	"claim_status" varchar(256) NOT NULL,
	"date_submitted" timestamp NOT NULL,
	"claim_decision" varchar(256),
	"date_of_last_update" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deployments" (
	"deployment_id" serial PRIMARY KEY NOT NULL,
	"service_history_id" integer NOT NULL,
	"location" varchar(256) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"operation_name" varchar(256),
	"service_type" varchar(256)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disabilities" (
	"disability_id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"name" varchar(256) NOT NULL,
	"diagnostic_code" varchar(256),
	"disability_rating" integer NOT NULL,
	"static_ind" boolean,
	"effective_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_uploads" (
	"request_id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"participant_id" integer NOT NULL,
	"file_number" varchar(256) NOT NULL,
	"claim_id" integer,
	"doc_type" varchar(256) NOT NULL,
	"file_name" varchar(256) NOT NULL,
	"tracked_item_ids" text[],
	"upload_status" varchar(256) NOT NULL,
	"uploaded_date_time" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"role" "user_system_enum" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_histories" (
	"service_history_id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"branch_of_service" varchar(256) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"service_type" varchar(256),
	"component_of_service" varchar(256),
	"separation_reason" varchar(256),
	"discharge_status" varchar(256),
	"rank_at_discharge" varchar(256),
	"mos" varchar(256)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"user_id" varchar(256) PRIMARY KEY NOT NULL,
	"ssn" varchar(11) NOT NULL,
	"first_name" varchar(256) NOT NULL,
	"last_name" varchar(256) NOT NULL,
	"date_of_birth" date NOT NULL,
	"email" varchar(256) NOT NULL,
	"phone_number" varchar(20),
	"street" text,
	"city" varchar(256),
	"state" varchar(2),
	"zip_code" varchar(10),
	"combined_disability_rating" integer,
	"discharge_status" varchar(256),
	"veteran_status" varchar(256)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appeal_events" ADD CONSTRAINT "appeal_events_appeal_id_appeals_appeal_id_fk" FOREIGN KEY ("appeal_id") REFERENCES "public"."appeals"("appeal_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appeal_issues" ADD CONSTRAINT "appeal_issues_appeal_id_appeals_appeal_id_fk" FOREIGN KEY ("appeal_id") REFERENCES "public"."appeals"("appeal_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appeals" ADD CONSTRAINT "appeals_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claims" ADD CONSTRAINT "claims_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claims" ADD CONSTRAINT "claims_service_history_id_service_histories_service_history_id_fk" FOREIGN KEY ("service_history_id") REFERENCES "public"."service_histories"("service_history_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_service_history_id_service_histories_service_history_id_fk" FOREIGN KEY ("service_history_id") REFERENCES "public"."service_histories"("service_history_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disabilities" ADD CONSTRAINT "disabilities_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_histories" ADD CONSTRAINT "service_histories_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
