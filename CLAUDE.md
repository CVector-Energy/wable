# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Build and run commands:
```bash
# Development (with TypeScript)
yarn dev --get-jobs --subdomain <subdomain> --token <token>
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
- **`src/workable-api.ts`**: Workable API client handling HTTP requests with axios
- **`src/candidate-manager.ts`**: Business logic for downloading and managing candidate files
- **`src/types.ts`**: TypeScript interfaces for Workable API responses

### Key Patterns

- **Error Handling**: Comprehensive error handling with axios error checking and user-friendly messages
- **Smart Updates**: Uses timestamp comparison (`updated_at` field) to only download candidates when they've been updated
- **File Organization**: Creates directories using sanitized email addresses and saves structured data as JSON with specific file naming conventions (`workable-index.json`, `workable-show.json`, `0-RESUME.pdf`, `0-COVER.txt`)
- **API Integration**: Three main API endpoints: jobs list, job candidates, and individual candidate details

### Data Flow

1. CLI parses options and validates required parameters (subdomain, token)
2. WorkableAPI class handles all HTTP requests to Workable's v3 API
3. For candidate downloads, CandidateManager orchestrates the process:
   - Fetches candidate list for a job
   - Checks each candidate's update timestamp
   - Downloads detailed candidate info and attachments only if updated
   - Creates organized directory structure per candidate

The application uses Workable API v3 endpoints and requires a valid API token and subdomain for authentication.