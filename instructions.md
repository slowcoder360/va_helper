# instructions.md

## 1. Project Overview

**VacaX** (working title: **va_helper**) is a Next.js application that helps U.S. military veterans file VA benefit claims. The app uses a combination of:

- **VA API Integrations** to securely fetch and update a user's data.  
- **AI Agents** (multi-agent system with a Supervisor) to guide veterans through claims, document uploads, and real-time Q&A about their PDF files.  
- **PostgreSQL** via Drizzle ORM for local data storage (user profiles, tokens, claim info).  
- **AWS S3** (and possibly other AWS services) for file uploads.  
- **Pinecone** for vector-based document search.  

Users log in through **ID.me/VA OAuth** (handled after their onboarding with the callback route) and can then upload documents, chat with an AI about them, and file official claims with the VA. The overall goal is to **simplify** and **automate** the complex VA claims process.

### Current Status & Next Steps

- **UI & Routes**: Basic routing is done (`app/(routes)/home`, `app/(routes)/profile`, etc.). Onboarding, doc chat (pdf-chat), dashboards, and some settings pages exist.  
- **Auth**: Clerk.js is set up; we can already obtain VA session tokens for a couple of the APIs.  
- **DB Schema**: A comprehensive set of tables is in place (user profiles, tokens, claims, appeals, etc.).  
- **Focus**: Expand the multi-agent AI architecture, integrate additional VA APIs (beyond the current 1–2), and begin **testing the "graph"** to see how claims can be built and submitted end-to-end.

---

## 2. Core Functionalities

Below is the **numbered breakdown** of VacaX's functionalities. Each top-level number (1, 2, 3...) represents a major feature area; sub-items detail the build steps or tasks for that feature.

---

### 1. **AI Multi-Agent System**

1.1 **Implement Multi-Agent Workflow**  
&nbsp;&nbsp;&nbsp;&nbsp;• Create a **Supervisor Agent** (ProjectManagerAgent) that orchestrates tasks among sub-agents.  
&nbsp;&nbsp;&nbsp;&nbsp;• Break down conversation logic, PDF analysis, data retrieval, and claim form creation into specialized **sub-agents**.  
&nbsp;&nbsp;&nbsp;&nbsp;• Connect each agent to the rest via a shared context (e.g., LangChain, LangGraph, or a custom approach).

1.2 **Set Up Conversation Agent**  
&nbsp;&nbsp;&nbsp;&nbsp;• Build a "front-line" LLM-based agent that interacts with the user in real-time.  
&nbsp;&nbsp;&nbsp;&nbsp;• Retrieve user context (profile, service history) from the Supervisor to personalize responses.

1.3 **Enable Claim-Building & Submission**  
&nbsp;&nbsp;&nbsp;&nbsp;• Have the Supervisor gather the necessary data from the user (disabilities, service history, supporting docs).  
&nbsp;&nbsp;&nbsp;&nbsp;• Pass data to a **Structured Output Agent** that formats the official claim in the correct JSON or PDF structure.

1.4 **Parallel Agent Tasks**  
&nbsp;&nbsp;&nbsp;&nbsp;• DB Query Agent: pulls data from Postgres or VA APIs.  
&nbsp;&nbsp;&nbsp;&nbsp;• PDF Processing Agent: handles PDF → text embeddings, Q&A via Pinecone.  
&nbsp;&nbsp;&nbsp;&nbsp;• Supervisor Agent merges all results for the final user response or form submission.

---

### 2. **VA API Integrations & Profile Completion**

2.1 **Fetch All Relevant VA APIs**  
&nbsp;&nbsp;&nbsp;&nbsp;• Expand beyond current calls to cover service history, disability ratings, claims status, letter generator, etc.  
&nbsp;&nbsp;&nbsp;&nbsp;• Use stored `accessToken` from `user_tokens` to authenticate each VA request.

2.2 **Store & Update Data in Postgres**  
&nbsp;&nbsp;&nbsp;&nbsp;• Ensure retrieved VA data (service histories, disabilities, etc.) is reflected in local tables (e.g., `serviceHistories`, `disabilities`).  
&nbsp;&nbsp;&nbsp;&nbsp;• Use **Drizzle ORM** migrations if new fields/tables are required.

2.3 **Sync With User Profiles**  
&nbsp;&nbsp;&nbsp;&nbsp;• Upon login or "profile refresh," query all relevant VA endpoints to build a **complete user profile**.  
&nbsp;&nbsp;&nbsp;&nbsp;• Allow user-supplied overrides if needed (some fields might be missing in VA data).

2.4 **Profile Dashboards & Data**  
&nbsp;&nbsp;&nbsp;&nbsp;• In `app/(routes)/profile`, display the aggregated data from VA + local DB.  
&nbsp;&nbsp;&nbsp;&nbsp;• Provide "refresh" or "check for updates" button to re-fetch from VA if the user wants to see the latest info.

---

### 3. **File Upload & Document Analysis**

3.1 **User Document Upload**  
&nbsp;&nbsp;&nbsp;&nbsp;• Use your existing `UploadDialog`, `fileUpload.tsx`, or `PDFViewer` components to let users attach files.  
&nbsp;&nbsp;&nbsp;&nbsp;• Store docs in **AWS S3** with a unique key, referencing them in the `chats` or `documentUploads` tables.

3.2 **PDF Parsing & Embeddings**  
&nbsp;&nbsp;&nbsp;&nbsp;• Convert uploaded PDF to text (using `pdf-parse`) or run OCR if needed.  
&nbsp;&nbsp;&nbsp;&nbsp;• Generate vector embeddings (via `lib/embeddings.ts`) and index them in **Pinecone** for chunk-based retrieval.

3.3 **PDF Chat Flow**  
&nbsp;&nbsp;&nbsp;&nbsp;• In `app/(routes)/(pdf-chat)`, ensure the conversation agent can query Pinecone for relevant document snippets.  
&nbsp;&nbsp;&nbsp;&nbsp;• Return chunk-based responses to the user, highlighting the portion(s) of the doc that match their question.

3.4 **Document Linking to Claims**  
&nbsp;&nbsp;&nbsp;&nbsp;• If a user is filing a claim, let them select relevant uploaded docs to attach.  
&nbsp;&nbsp;&nbsp;&nbsp;• For official submission, use the **VA Benefits Intake API** to send the doc references.

---

### 4. **Real-Time Chat & Claim Chat**

4.1 **Chat UI Components**  
&nbsp;&nbsp;&nbsp;&nbsp;• You already have `ChatComponent.tsx`, `ClaimChatComponent.tsx`, `MessageList.tsx`, etc.  
&nbsp;&nbsp;&nbsp;&nbsp;• Confirm accessibility (keyboard focus, screen reader labels) for **Section 508** compliance.

4.2 **Claim-Specific Chat**  
&nbsp;&nbsp;&nbsp;&nbsp;• In `app/api/(claims)/claim-chat/route.ts`, build logic for a multi-step conversation that **collects** info needed for the claim.  
&nbsp;&nbsp;&nbsp;&nbsp;• Store these messages in `claimMessages` for an audit trail.

4.3 **Structured Output Agent**  
&nbsp;&nbsp;&nbsp;&nbsp;• Once enough data is gathered, have an AI agent format the final "claim payload."  
&nbsp;&nbsp;&nbsp;&nbsp;• Send that payload to the **Claims API** (and track the claim in the `claims` table with status updates).

4.4 **Edge Cases & Error Handling**  
&nbsp;&nbsp;&nbsp;&nbsp;• Gracefully handle missing tokens, expired tokens, or partial data from VA.  
&nbsp;&nbsp;&nbsp;&nbsp;• Provide user-friendly fallback text if an API call fails.

---

### 5. **Database & Schema Management**

5.1 **Review & Update DB Tables**  
&nbsp;&nbsp;&nbsp;&nbsp;• You have a thorough schema (`user_profiles`, `serviceHistories`, `disabilities`, `claims`, etc.).  
&nbsp;&nbsp;&nbsp;&nbsp;• Confirm that fields match the expanded data from new VA APIs. Add or modify columns if needed via Drizzle migrations.

5.2 **Store Additional Fields From VA**  
&nbsp;&nbsp;&nbsp;&nbsp;• For example, if the VA APIs return extra detail on each disability, store it in `disabilities`.  
&nbsp;&nbsp;&nbsp;&nbsp;• Check if your existing columns (e.g., `diagnosticCode`, `disabilityRating`) are adequate or need more context.

5.3 **Sync Logic**  
&nbsp;&nbsp;&nbsp;&nbsp;• Decide how to handle "sync cycles"—whether to do a forced refresh at user login or keep a scheduled job to update.  
&nbsp;&nbsp;&nbsp;&nbsp;• Mark stale data or track "last VA sync" in the DB.

5.4 **Reference Data**  
&nbsp;&nbsp;&nbsp;&nbsp;• Explore using `./VA/descriptive_json/*` (e.g., `title-38.json`, `Benefits_Intake_API_Info_JSON.json`) for local reference.  
&nbsp;&nbsp;&nbsp;&nbsp;• Possibly store these references in the DB or keep them as JSON files for quick read access in the app.

---

### 6. **Testing the Graph & Claim Submission**

6.1 **Integration Testing**  
&nbsp;&nbsp;&nbsp;&nbsp;• Create test user accounts in your dev environment.  
&nbsp;&nbsp;&nbsp;&nbsp;• Step through the entire conversation (e.g., `claimChats` route) to see if the correct claim JSON is generated.

6.2 **VA Sandbox**  
&nbsp;&nbsp;&nbsp;&nbsp;• Use the VA developer sandbox endpoints for end-to-end submission testing.  
&nbsp;&nbsp;&nbsp;&nbsp;• Verify that you receive a valid "claim tracking number" or reference ID from the VA system.

6.3 **Agent Collaboration**  
&nbsp;&nbsp;&nbsp;&nbsp;• Verify that the **ProjectManagerAgent** (Supervisor) delegates tasks correctly to DB Query, PDF Processing, etc.  
&nbsp;&nbsp;&nbsp;&nbsp;• Check concurrency: can the system handle parallel document parsing while the user continues chatting?

6.4 **Performance & Logging**  
&nbsp;&nbsp;&nbsp;&nbsp;• Monitor logs (e.g., in `./app/api/create-chat/route.ts` or other routes) to confirm no timeouts or unhandled exceptions.  
&nbsp;&nbsp;&nbsp;&nbsp;• For multi-step claims, ensure you have rollback logic or graceful error states if something fails mid-flow.

---

## 3. Documentation & Dependencies

### 3.1 Existing File Tree

Below is a **high-level** reference to your current file structure, focusing on notable directories:


### 3.2 Database Schema

Your `db/schema.ts` covers comprehensive entities:

- **userProfiles**, **userTokens**, **serviceHistories**, **disabilities**, **claims**, **claimChats**, etc.  
- Each table references user IDs (from `user_profiles`) or each other via foreign keys.  
- Cascade deletes ensure data consistency when a user or higher-level record is removed.  

As you integrate more VA endpoints, confirm that the schema can capture any extra fields (e.g., additional disability details, medication data, appointment data, etc.). Add migrations as needed.

### 3.3 Key Dependencies

Below are some **notable packages** from your `package.json` (production dependencies). This list helps your team or an AI agent understand what's available:

- **`next`, `react`, `react-dom`**: Core Next.js + React frameworks.  
- **`@clerk/nextjs`**: Authentication (ID.me/VA OAuth) and session management.  
- **`@aws-sdk/client-s3`**: AWS S3 integration for file uploads.  
- **`@pinecone-database/pinecone`, `@pinecone-database/doc-splitter`**: Vector storage and doc chunking for PDF chat.  
- **`langchain`, `@langchain/langgraph`**: Building advanced LLM workflows, multi-agent orchestration.  
- **`drizzle-orm`** + **`pg`**: Database ORM and Postgres driver.  
- **`pdf-parse`**: PDF text extraction.  
- **`openai-edge`, `ai`**: LLM calls for the AI agent.  
- **`axios`**: HTTP client (can be used for calling VA APIs).  
- **`puppeteer`**: Headless browser automation (optional—could be used for generating PDFs or scraping, if needed).  
- **`zod`, `@hookform/resolvers`, `react-hook-form`**: Form validation and schema definitions.  
- **`tailwindcss`** + **`tailwindcss-animate`** + **`@radix-ui/*`**: UI styling and animations.  

Check your **devDependencies** for linting, TypeScript, Drizzle CLI, etc.

---

## 4. Usage & Development Flow

1. **Set Environment Variables**: Configure `.env` or environment variables for VA API credentials, AWS S3, Pinecone keys, etc.  
2. **Run Migrations**: Use **Drizzle** to migrate your local/remote Postgres (`pnpm drizzle-kit up` or similar).  
3. **Start Dev Server**: `pnpm dev` (or `npm run dev` / `yarn dev`) runs the Next.js development environment.  
4. **Explore Core Features**:  
   - **Profile**: `app/(routes)/profile` – Confirm user data & sync with VA.  
   - **PDF Chat**: `app/(routes)/(pdf-chat)/pdf-chat/[chatId]` – Test file upload and embeddings.  
   - **Claim Filing**: `app/(routes)/file-a-claim/[newClaimId]` – Work with the multi-agent logic to gather claim details.
5. **Implement & Test Agents**:  
   - Create or refine your multi-agent classes in `lib/agents/`.  
   - Link them in the chat routes (`app/api/(claims)/claim-chat/route.ts`) or a new route if needed.  
   - Use **LangChain** or **LangGraph** to structure how tasks are delegated (Supervisor → DB Query Agent → PDF Processing Agent, etc.).
6. **QA & 508 Compliance**:  
   - Ensure all UI components are keyboard-accessible and have proper ARIA labels.  
   - Test color contrast, screen-reader behavior, and error states.

---

## 5. Final Notes

- **Agent Collaboration**: Focus on how the Supervisor (ProjectManagerAgent) orchestrates the conversation, pulling data from Postgres/VA, and referencing PDF embeddings from Pinecone.  
- **VA API Expansion**: Integrate additional endpoints (e.g., Veteran Verification, Facilities, Letters, etc.) to build out the most accurate user profile. This may require new tables or fields in `db/schema.ts`.  
- **Testing & Iteration**: Use sample user accounts or test users in the VA sandbox environment. Update the code if you encounter new data fields or constraints.  
- **Security**: Validate all tokens, keep user data safe in S3 (private bucket with presigned URLs), and remove logs with PII.

By following these **instructions** and checking off each **core functionality**, you'll build a complete, AI-driven VA claims solution that helps veterans streamline their benefit filing process.
