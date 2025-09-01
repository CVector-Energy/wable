# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Build and run commands:

```bash
# Development (with TypeScript)
yarn dev --get-jobs --subdomain <subdomain> --token <token>
yarn dev --process-jobs --subdomain <subdomain> --token <token> --base-dir ./output
yarn dev --get-candidates <jobShortcode> --subdomain <subdomain> --token <token>

# Build
yarn build

# Production
yarn start --get-jobs --subdomain <subdomain> --token <token>

# Testing
yarn test
yarn test:watch
```

## Architecture

This is a TypeScript CLI application for interacting with the Workable API. The architecture follows a clean separation of concerns:

### Core Components

- **`src/index.ts`**: CLI entry point using Commander.js for option parsing
- **`src/workable-api.ts`**: Workable API client handling HTTP requests with axios and rate limiting
- **`src/candidate-manager.ts`**: Business logic for downloading and managing candidate files
- **`src/job-manager.ts`**: Business logic for processing jobs and recruitment stages
- **`src/types.ts`**: TypeScript interfaces for Workable API responses

### Key Patterns

- **Rate Limiting**: Respects Workable API rate limits (10 requests per 10 seconds for account tokens) with automatic queuing and waiting
- **Error Handling**: Comprehensive error handling with axios error checking, rate limit detection (429 errors), and user-friendly messages
- **Smart Updates**: Uses timestamp comparison (`updated_at` field) to only download candidates when they've been updated
- **File Organization**:
  - Candidates: `candidates/{email}/` with files (`workable-index.json`, `workable-show.json`, `0-PROFILE.md`, `0-RESUME.pdf`, `0-COVER.txt`)
  - Jobs: `jobs/{shortcode}/` with files (`job-index.json`, `stages.json`, `stages.md`)
- **API Integration**: Four main API endpoints: jobs list, job candidates, individual candidate details, and job stages

### Data Flow

1. CLI parses options and validates required parameters (subdomain, token)
2. WorkableAPI class handles all HTTP requests to Workable's v3 API with automatic rate limiting:
   - Tracks rate limit headers (`X-Rate-Limit-Remaining`, `X-Rate-Limit-Reset`)
   - Queues requests and adds delays between them to prevent rate limit violations
   - Automatically waits when rate limits are reached
3. For candidate downloads, CandidateManager orchestrates the process:
   - Fetches candidate list for a job
   - Checks each candidate's update timestamp
   - Downloads detailed candidate info and attachments only if updated
   - Generates markdown profile with formatted candidate information
   - Downloads resume from S3 (doesn't count against API quota)
   - Creates organized directory structure per candidate under `candidates/`

4. For job processing, JobManager handles the workflow:
   - Fetches all jobs from the organization
   - For each job, gets recruitment stages information
   - Generates structured JSON files and formatted markdown
   - Creates organized directory structure per job under `jobs/{shortcode}/`

The application uses Workable API v3 endpoints and requires a valid API token and subdomain for authentication.
