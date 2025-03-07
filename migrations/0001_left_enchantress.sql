CREATE TABLE IF NOT EXISTS "claim_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"claim_type" varchar(100),
	"status" varchar(50) DEFAULT 'in_progress',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claim_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"claim_chat_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"role" "user_system_enum" NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claim_chats" ADD CONSTRAINT "claim_chats_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claim_messages" ADD CONSTRAINT "claim_messages_claim_chat_id_claim_chats_id_fk" FOREIGN KEY ("claim_chat_id") REFERENCES "public"."claim_chats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
