# Wable

A TypeScript command-line application for interacting with the Workable API to download candidate information.

## Features

- **Job Listings**: Fetch and display available jobs from your Workable account
- **Candidate Download**: Download candidate information, resumes, and cover letters
- **Smart Updates**: Only downloads candidates when they've been updated since last fetch
- **TypeScript**: Fully typed with comprehensive error handling
- **CLI Interface**: Simple command-line interface using Commander.js

## Installation

```bash
# Install dependencies
yarn install

# Build the application
yarn build
```

## Usage

### Get Jobs

Fetch and display all available jobs from your Workable account:

```bash
yarn dev --get-jobs --subdomain your-company --token your-api-token
```

**Parameters:**
- `--get-jobs`: Fetch and display job listings
- `--subdomain <subdomain>`: Your Workable subdomain (required)
- `--token <token>`: Your Workable API token (required)

**Output:**
```
Available Jobs:
Software Engineer (SE001)
Product Manager (PM001)
Marketing Specialist (MS001)
```

### Get Candidates

Download candidate information for a specific job:

```bash
yarn dev --get-candidates SE001 --subdomain your-company --token your-api-token
```

**Parameters:**
- `--get-candidates <jobShortcode>`: Download candidates for the specified job
- `--subdomain <subdomain>`: Your Workable subdomain (required)  
- `--token <token>`: Your Workable API token (required)

**What gets downloaded:**
- Creates a directory for each candidate using their email address
- `workable-index.json`: Basic candidate information from the candidates list
- `workable-show.json`: Detailed candidate information from individual candidate API call
- `0-RESUME.pdf`: Resume file (if available)
- `0-COVER.txt`: Cover letter text (if provided)

**Smart Updates:**
The application checks the `updated_at` timestamp and only downloads candidates that are new or have been updated since the last download.

**Example directory structure:**
```
john.doe@example.com/
├── workable-index.json
├── workable-show.json
├── 0-RESUME.pdf
└── 0-COVER.txt

jane.smith@company.com/
├── workable-index.json
├── workable-show.json
└── 0-RESUME.pdf
```

### API Token

To use this application, you need a Workable API token. You can generate one from your Workable account settings under API Access.

## Development

```bash
# Run in development mode
yarn dev

# Run tests
yarn test

# Watch tests
yarn test:watch

# Build for production
yarn build

# Run built application
yarn start
```

## API Reference

This application uses the [Workable API v3](https://workable.readme.io/reference) endpoints:
- [Jobs](https://workable.readme.io/reference/jobs) - List available jobs
- [Job Candidates](https://workable.readme.io/reference/job-candidates-index) - List candidates for a job
- [Candidate Details](https://workable.readme.io/reference/job-candidates-show) - Get detailed candidate information

## Testing

The application includes comprehensive unit tests covering:
- Workable API client functionality
- Candidate download and file management
- Timestamp comparison and smart updates
- CLI option parsing and execution
- Error handling for network and API errors

Run tests with:
```bash
yarn test
```
