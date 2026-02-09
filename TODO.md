# VA Helper Application TODO List

## 1. Database Schema Updates
- [ ] Implement schema changes from SCHEMA_UPDATE_PLAN.md
- [ ] Add VA-specific fields to existing tables
- [ ] Create new tables for VA data
- [ ] Update relationships between tables

## 2. API Structure Reorganization
- [x] Consolidate VA-related endpoints under `app/api/(va)/`
- [x] Create new directory structure
- [x] Move existing endpoints to new structure
- [x] Update route handlers to use new paths

## 3. VA API Integration
- [ ] Create VA API Client (`lib/services/vaApiClient.ts`)
  - [ ] Implement token management
  - [ ] Add basic error handling
  - [ ] Add logging

- [ ] Implement VA API Endpoints:
  - [x] Service History
    - [x] Fetch from VA API
    - [x] Store in database
    - [x] Retrieve from database
  - [ ] Disability Ratings
    - [ ] Fetch from VA API
    - [ ] Store in database
    - [ ] Retrieve from database
  - [ ] Medical Records
    - [ ] Fetch from VA API
    - [ ] Store in database
    - [ ] Retrieve from database
  - [ ] Claims
    - [ ] Fetch from VA API
    - [ ] Store in database
    - [ ] Retrieve from database
  - [ ] Appeals
    - [ ] Fetch from VA API
    - [ ] Store in database
    - [ ] Retrieve from database

## 4. Authentication & Authorization
- [x] Implement ID.me OAuth flow
  - [x] Handle callback
  - [x] Store tokens securely
  - [ ] Implement token refresh

## 5. Testing & Validation
- [ ] Basic Testing
  - [ ] Test VA API client
  - [ ] Test database operations
  - [ ] Test route handlers
- [ ] Data Validation
  - [ ] Input validation
  - [ ] Output validation
  - [ ] Error handling

## 6. Documentation
- [ ] Basic API Documentation
  - [ ] Endpoint descriptions
  - [ ] Request/response formats
- [ ] Database Schema Documentation
  - [ ] Table relationships
  - [ ] Field descriptions

## Current Status
- ✅ Basic application structure in place
- ✅ Initial database schema implemented
- ✅ ID.me OAuth integration started
- ✅ Basic service history integration
- ✅ API structure reorganized
- 🔄 Need to implement VA API client
- 🔄 Need to complete VA API integrations
- 🔄 Need to update database schema

## Next Steps
1. Create VA API client
2. Implement schema changes
3. Add remaining VA API integrations 