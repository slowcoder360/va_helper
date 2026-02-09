-- Add source tracking columns to claims and disabilities
ALTER TABLE "claims" ADD COLUMN "source" varchar(50) DEFAULT 'user';
ALTER TABLE "disabilities" ADD COLUMN "source" varchar(50) DEFAULT 'user';

-- Add unique constraint on user_tokens.user_id
-- (one token record per user; on conflict, existing should be updated)
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_unique" UNIQUE ("user_id");

-- Performance indexes on frequently queried columns
CREATE INDEX IF NOT EXISTS "idx_claims_user_id" ON "claims" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_claims_status" ON "claims" ("claim_status");
CREATE INDEX IF NOT EXISTS "idx_claims_source" ON "claims" ("source");
CREATE INDEX IF NOT EXISTS "idx_disabilities_user_id" ON "disabilities" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_disabilities_source" ON "disabilities" ("source");
CREATE INDEX IF NOT EXISTS "idx_service_histories_user_id" ON "service_histories" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_chats_user_id" ON "chats" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_messages_chat_id" ON "messages" ("chat_id");
CREATE INDEX IF NOT EXISTS "idx_messages_created_at" ON "messages" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_claim_chats_user_id" ON "claim_chats" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_claim_messages_chat_id" ON "claim_messages" ("claim_chat_id");
CREATE INDEX IF NOT EXISTS "idx_claim_messages_created_at" ON "claim_messages" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_veteran_profiles_user_id" ON "veteran_profiles" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_tokens_user_id" ON "user_tokens" ("user_id");
