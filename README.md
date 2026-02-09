# VA Helper

A Next.js application designed to assist with VA (Veterans Affairs) claims processing and management. The application provides a modern interface for handling VA-related documents, claims processing, and AI-powered assistance.

## Project Structure

```
va_helper/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── (routes)/          # Application routes
│   └── (auth)/            # Authentication routes
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── dashboard/        # Dashboard components
│   └── hooks/            # Custom React hooks
├── lib/                  # Core functionality
│   ├── agents/          # AI agent implementations
│   ├── services/        # Business logic services
│   ├── db/              # Database related code
│   └── checkpointing/   # State management
├── public/              # Static assets
└── VA/                  # VA-specific functionality
```

## Core Functionality

### `/lib` Directory Structure

#### Core Services
- **/services**: Business logic services and external service integrations
- **/db**: Database operations, models, and connection management
- **/checkpointing**: State management and persistence for agent workflows

#### AI & Agent Implementation
- **/agents**: Core agent implementations and configurations
- **/agentInstructions**: Instructions and prompts for different agent types
- **/agentTools**: Custom tools and utilities for agent operations
- **/langgraph-examples**: Example implementations and tutorials
  - **/agent_executor**: Basic agent execution patterns
  - **/chat_agent_executor_with_function_calling**: Agent implementation with function calling capabilities
  - **/chatbots**: Chatbot implementations and patterns
  - **/chatbot-simulation-evaluation**: Tools for evaluating chatbot performance
  - **/how-tos**: Step-by-step guides for common tasks
  - **/multi_agent**: Multi-agent collaboration patterns
  - **/plan-and-execute**: Planning and execution workflows
  - **/rag**: Retrieval-Augmented Generation implementations
  - **/reflection**: Agent reflection and self-improvement patterns
  - **/rewoo**: ReWOO (Reasoning With Observation) implementations
  - **/workflows**: Complex workflow patterns
  - **quickstart.ipynb**: Quick start guide for LangGraph

#### Storage & Integration
- **AWS S3** (`s3.ts`, `s3-server.ts`):
  - File upload and retrieval
  - Document storage management
  - Secure file access control

- **Pinecone** (`pinecone.ts`):
  - Vector database integration
  - Document embedding storage
  - Semantic search capabilities

#### Utilities
- **Logging** (`logging.ts`): Application-wide logging and error tracking
- **Context Management** (`context.ts`): Application state and session handling
- **Embeddings** (`embeddings.ts`): Text embedding generation and semantic search
- **General Utilities** (`utils.ts`): Common helper functions and type conversions

## API Overview

### Authentication & User Management
- **OAuth Callback** (`/api/(oauth)/oauth/callback`): Handles VA OAuth authentication flow
- **Profile Management** (`/api/(profile)/*`):
  - `get-profile`: Retrieves user profile information
  - `update-profile`: Updates user profile data
  - `create-profile`: Creates new user profile
  - `delete-account`: Handles account deletion

### VA Integration
- **Service History** (`/api/(va)/va/*`):
  - `get-service-history`: Retrieves military service history
  - `fetch-data`: Fetches and stores VA data (service history, disability ratings)
- **Claims Processing** (`/api/(claims)/*`):
  - `claims`: Manages VA claims
  - `claim-chat`: AI-powered chat interface for claims assistance

### Document Processing
- **PDF Chat** (`/api/pdf-chat`): AI-powered chat interface for PDF documents
- **Research** (`/api/research`): Processes and stores research data in Pinecone
- **Create Chat** (`/api/create-chat`): Creates new chat sessions for document analysis

### Messaging
- **Get Messages** (`/api/get-messages`): Retrieves chat messages
- **Claim Chat** (`/api/(claims)/claim-chat`): Manages claim-related chat sessions

### Testing
- **Test Route** (`/api/test-route`): Simple test endpoint for API functionality

## Key Features

- **Document Management**: Upload and process VA-related documents
- **AI-Powered Assistance**: Chat interface for VA claims assistance
- **User Authentication**: Secure user management with Clerk
- **Database Integration**: PostgreSQL with Drizzle ORM
- **File Storage**: AWS S3 integration for document storage
- **AI Integration**: LangChain and OpenAI for intelligent assistance

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Clerk
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **Storage**: AWS S3
- **AI**: LangChain, OpenAI
- **State Management**: React Query
- **UI Components**: Radix UI

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Create a `.env` file based on `.env.example`
   - Add necessary API keys and configuration

4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

Required environment variables:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_ENVIRONMENT`
- `PINECONE_INDEX_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `DATABASE_URL`
- `VA_TOKEN_URL`
- `VA_SERVICE_HISTORY_CLIENT_ID`
- `VA_SERVICE_HISTORY_CLIENT_SECRET`
- `VA_OAUTH_REDIRECT_URI`
- `VA_VERIFICATION_API_BASE_URL`

## Development

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request

## License

[Add your license information here]

## Components Overview

### Core Components
- **MessageList.tsx**: Displays chat messages and conversation history
- **ClaimChatComponent.tsx**: AI-powered chat interface for claims assistance
- **ChatSideBar.tsx**: Navigation sidebar for chat functionality
- **HomeSidebar.tsx**: Main navigation sidebar
- **ClaimsChatSideBar.tsx**: Specialized sidebar for claims chat
- **fileUpload.tsx**: Document upload functionality
- **UploadDialog.tsx**: Modal dialog for file uploads
- **OnboardingForm.tsx**: User onboarding and profile setup
- **VaConnectButton.jsx**: VA OAuth connection button
- **ProfilePage.tsx**: User profile management
- **HeaderNav.tsx**: Main navigation header
- **HomeNavBar.tsx**: Home page navigation
- **ChatComponent.tsx**: Base chat interface
- **FooterNav.tsx**: Application footer
- **PDFViewer.tsx**: PDF document viewer
- **Providers.tsx**: React context providers

### Dashboard Components
- **Notifications.tsx**: User notification system
- **ClaimsCard.tsx**: Claim status and information display
- **RecentChats.tsx**: Recent chat history display
- **PendingForms.tsx**: Pending form management
- **FileUploadCard.tsx**: Document upload interface
- **RatingCard.tsx**: Disability rating display

### UI Components
- **button.tsx**: Custom button components
- **card.tsx**: Card layout components
- **dialog.tsx**: Modal dialog components
- **form.tsx**: Form components and validation
- **input.tsx**: Input field components
- **label.tsx**: Form label components
- **separator.tsx**: Visual separator components
- **table.tsx**: Data table components
- **textarea.tsx**: Text area components
- **toast.tsx**: Notification toast components
- **toaster.tsx**: Toast notification system
- **badge.tsx**: Status badge components

## Application Routes & Dependencies

### Route Structure
```
app/(routes)/
├── home/                    # Main dashboard
│   └── page.tsx            # Uses: ClaimsCard, RatingCard, FileUploadCard, PendingForms, RecentChats, Notifications
├── profile/                # User profile management
│   └── page.tsx            # Uses: ProfilePage component
├── file-a-claim/          # Claims processing
│   └── [newClaimId]/      # Dynamic claim pages
│       └── page.tsx        # Uses: ClaimChatComponent, ClaimsChatSideBar, db schema
├── (pdf-chat)/            # PDF document chat interface
├── research/              # Research and document analysis
├── onboarding/            # User onboarding flow
└── error/                 # Error handling pages
```

### Route Dependencies & Relationships

#### Home Route (`/home`)
- **Components Used**:
  - `ClaimsCard` - Displays claim status and information
  - `RatingCard` - Shows disability rating and compensation
  - `FileUploadCard` - Document upload interface
  - `PendingForms` - Displays pending form submissions
  - `RecentChats` - Shows recent chat history
  - `Notifications` - Displays user notifications
- **Data Flow**:
  - Static mock data for demonstration
  - In production, would connect to database via API routes

#### Profile Route (`/profile`)
- **Components Used**:
  - `ProfilePage` - Main profile management interface
- **Dependencies**:
  - Clerk authentication
  - Database schema for user profiles
  - VA API integration for veteran data

#### File a Claim Route (`/file-a-claim/[newClaimId]`)
- **Components Used**:
  - `ClaimChatComponent` - AI-powered claim assistance
  - `ClaimsChatSideBar` - Navigation for claim chats
- **Dependencies**:
  - Database schema (`claimChats` table)
  - Clerk authentication
  - AI agent implementation
- **Data Flow**:
  - Fetches user's claim chats from database
  - Validates claim ID and user access
  - Renders chat interface for claim processing

#### PDF Chat Route (`/(pdf-chat)`)
- **Components Used**:
  - `PDFViewer` - Document display
  - `ChatComponent` - Chat interface
- **Dependencies**:
  - AWS S3 for document storage
  - Pinecone for document embeddings
  - AI agents for document analysis

#### Research Route (`/research`)
- **Components Used**:
  - `ChatComponent` - Research chat interface
- **Dependencies**:
  - Pinecone vector database
  - AI agents for research assistance
  - VA regulations database

#### Onboarding Route (`/onboarding`)
- **Components Used**:
  - `OnboardingForm` - User registration and setup
  - `VaConnectButton` - VA OAuth connection
- **Dependencies**:
  - VA OAuth integration
  - Database schema for user profiles
  - Form validation and processing

### Cross-Route Dependencies

1. **Authentication & Authorization**
   - Clerk authentication used across all routes
   - User session management via context
   - Protected route middleware

2. **Data Management**
   - Database operations via Drizzle ORM
   - API routes for data fetching and updates
   - State management with React Query

3. **AI Integration**
   - LangChain agents for various tasks
   - OpenAI integration for chat functionality
   - Document analysis and processing

4. **File Management**
   - AWS S3 for document storage
   - PDF processing and viewing
   - Document upload and management
