CREATE TABLE IF NOT EXISTS "veteran_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"veteran_id" varchar(256),
	"first_name" varchar(256),
	"last_name" varchar(256),
	"date_of_birth" date,
	"ssn" varchar(11),
	"branch" varchar(256),
	"service_start_date" date,
	"service_end_date" date,
	"discharge_type" varchar(256),
	"rank" varchar(256),
	"disabilities" jsonb DEFAULT '[]'::jsonb,
	"medical_records" jsonb DEFAULT '[]'::jsonb,
	"service_records" jsonb DEFAULT '[]'::jsonb,
	"last_update" timestamp DEFAULT now(),
	"conversation_context" text,
	"is_verified" boolean DEFAULT false,
	"verification_source" varchar(256),
	"verification_date" timestamp,
	"claim_relevant_periods" jsonb DEFAULT '[]'::jsonb,
	"exposures_and_incidents" jsonb DEFAULT '[]'::jsonb,
	"treatment_facilities" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "veteran_profiles" ADD CONSTRAINT "veteran_profiles_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
