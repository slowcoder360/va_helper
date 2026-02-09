# VacaX Testing Checklist

## Prerequisites

### 1. Environment Setup
```bash
# Copy env example and fill in values
cp .env.example .env.local
```

Required variables:
- [ ] `DATABASE_URL` - Neon/PostgreSQL connection string
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`
- [ ] `NEXT_PUBLIC_OPENAI_API_KEY`
- [ ] `NEXT_PUBLIC_PINECONE_API_KEY`
- [ ] VA API credentials (see below)

### 2. Database Setup
```bash
# Run migrations
npx drizzle-kit push

# Or generate and run SQL
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 3. Index Knowledge Base
```bash
# Run the v3 indexer (privacy-preserving, with cross-references)
npx tsx scripts/index-va-knowledge-v3.ts
```

This indexes:
- Title 38 CFR (VA regulations)
- VA API documentation

---

## Testing Options

### Option A: ID.me Sandbox (Fake Veterans)

1. Register at [developer.va.gov](https://developer.va.gov)
2. Create a sandbox app
3. Use sandbox OAuth URLs:
   - Auth: `https://sandbox-api.va.gov/oauth2/authorization`
   - Token: `https://sandbox-api.va.gov/oauth2/token`
4. Test with ID.me sandbox accounts (fake veterans provided by VA)

### Option B: Your Own VA Data

1. Same setup as Option A
2. Use your real VA credentials through ID.me
3. **Privacy note**: Your data stays local - AI layer never sees PII

### Option C: Manual Data Entry (No OAuth)

Skip VA OAuth entirely by manually inserting test data:

```sql
-- Insert test veteran profile
INSERT INTO user_profiles (user_id, first_name, last_name, combined_disability_rating)
VALUES ('clerk_user_id', 'Test', 'Veteran', 70);

-- Insert test disabilities
INSERT INTO disabilities (user_id, name, diagnostic_code, disability_rating)
VALUES 
  ('clerk_user_id', 'PTSD', '9411', 50),
  ('clerk_user_id', 'Tinnitus', '6260', 10),
  ('clerk_user_id', 'Lower Back Strain', '5237', 20);

-- Insert service history
INSERT INTO service_histories (user_id, branch_of_service, discharge_status)
VALUES ('clerk_user_id', 'Army', 'Honorable');
```

---

## Test Scenarios

### 1. Basic Chat Flow
- [ ] Send a message, get response
- [ ] Verify message persists on refresh
- [ ] Check that chat history loads

### 2. Rating Calculator
Ask: "I have 50% for PTSD and 30% for back pain. What's my combined rating?"
- [ ] Should calculate: 65% → rounds to 70%
- [ ] Shows step-by-step VA math

### 3. Regulation Search
Ask: "What are the rating criteria for PTSD?"
- [ ] Should return 38 CFR 4.130 criteria
- [ ] Cites specific diagnostic code 9411

### 4. Rating Impact Estimate  
Ask: "If I get 10% for tinnitus, will it change my 70% combined?"
- [ ] Should explain 10% gets absorbed by rounding
- [ ] Suggests what rating would actually increase combined

### 5. Condition-Specific Search
Ask: "What evidence do I need for sleep apnea secondary to PTSD?"
- [ ] Returns relevant regulations
- [ ] Mentions nexus requirement

### 6. VA OAuth Flow (if using Option A or B)
- [ ] Click "Connect with VA.gov"
- [ ] Redirects to VA login
- [ ] Returns with service history populated
- [ ] Disabilities populated from VA

---

## Privacy Verification

Verify that PII never reaches third-party APIs:

### Check 1: OpenAI Embedding Requests
In browser dev tools Network tab, look for calls to OpenAI embedding API.
- Should see hypothetical documents, NOT user questions with names

### Check 2: System Prompt
Add `console.log(systemPrompt)` in route.ts
- Should show conditions and ratings, NOT names or SSNs

### Check 3: Tool Responses
Check `getVeteranProfileTool` responses
- Should return `claimsContext` with conditions
- Should NOT include name, DOB, SSN

---

## Common Issues

### "Stored state is missing"
OAuth state cookie not set. Ensure `/api/oauth/initiate` is called before redirect.

### "User ID not found in session"
Clerk user not authenticated, or cookie not set. Check Clerk middleware.

### "No matching regulations found"
Pinecone not indexed. Run: `npx tsx scripts/index-va-knowledge-v3.ts`

### "Failed to retrieve VA context"
Check Pinecone API key and index name.

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Run migrations
npx drizzle-kit push

# Index knowledge base
npx tsx scripts/index-va-knowledge-v3.ts

# Start dev server
npm run dev
```

Then:
1. Sign in with Clerk
2. Go to chat
3. Ask: "What's the rating criteria for tinnitus?"
