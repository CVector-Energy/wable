# Wable

A command-line application for interacting with the Workable API to download candidate information.

## Features

- **Job Listings**: Fetch and display available jobs from your Workable account
- **Job Processing**: Download complete job information with recruitment stage details
- **Candidate Download**: Download candidate information, resumes, and cover letters
- **Candidate Management**: Move disqualified candidates to separate directories for organization
- **Smart Updates**: Only downloads candidates when they've been updated since last fetch
- **TypeScript**: Fully typed with comprehensive error handling
- **CLI Interface**: Simple command-line interface using Commander.js
- **Organized Structure**: Candidates saved to `candidates/` and jobs to `jobs/{shortcode}/`

## Installation

```bash
# Install dependencies
yarn install

# Build the application
yarn build
```

## Usage

### Get Jobs

Download complete job information including recruitment stages:

```bash
yarn dev --get-jobs --subdomain your-company --token your-api-token --base-dir ./output

# Only get jobs updated since a specific date
yarn dev --get-jobs --subdomain your-company --token your-api-token --updated-after 2023-12-01T00:00:00Z
```

**Parameters:**
- `--get-jobs`: Download all jobs with stage information
- `--subdomain <subdomain>`: Your Workable subdomain (required)  
- `--token <token>`: Your Workable API token (required)
- `--base-dir <directory>`: Output directory (optional, defaults to current directory)
- `--updated-after <date>`: Only download jobs updated after this date (ISO format, optional)

**What gets created:**
```
jobs/
├── SE001/
│   ├── job-index.json     # Complete job information
│   ├── stages.json        # Raw stages data from API
│   └── stages.md         # Formatted recruitment pipeline
└── PM001/
    ├── job-index.json
    ├── stages.json
    └── stages.md
```

### Get Candidates

Download candidate information for a specific job:

```bash
yarn dev --get-candidates --shortcode SE001 --subdomain your-company --token your-api-token

# Only get candidates updated since a specific date
yarn dev --get-candidates --shortcode SE001 --subdomain your-company --token your-api-token --updated-after 2023-12-01T00:00:00Z
```

**Parameters:**
- `--get-candidates`: Download candidates for a specific job
- `--shortcode <jobShortcode>`: Job shortcode (required when using --get-candidates)
- `--subdomain <subdomain>`: Your Workable subdomain (required)  
- `--token <token>`: Your Workable API token (required)
- `--updated-after <date>`: Only download candidates updated after this date (ISO format, optional)

### Move Disqualified Candidates

Move disqualified candidates to a separate directory based on their metadata:

```bash
yarn dev --move-disqualified-candidates-to ./disqualified --subdomain your-company --token your-api-token --base-dir ./output
```

**Parameters:**
- `--move-disqualified-candidates-to <directory>`: Move disqualified candidates to specified directory
- `--base-dir <directory>`: Source directory containing candidates (optional, defaults to current directory)
- `--subdomain <subdomain>`: Your Workable subdomain (required)  
- `--token <token>`: Your Workable API token (required)

This command reads candidate metadata from `workable-index.json` files and moves candidates where `disqualified` is `true` to the specified directory. If the destination already contains a candidate with the same email, the files will be overwritten.

**What gets downloaded:**
- Creates a directory for each candidate using their email address under `candidates/`
- `workable-index.json`: Basic candidate information from the candidates list
- `workable-show.json`: Detailed candidate information from individual candidate API call
- `0-PROFILE.md`: Formatted markdown profile with all candidate information
- `0-RESUME.pdf`: Resume file (if available, downloaded from S3)
- `0-COVER.txt`: Cover letter text (if provided)

**Complete Data Retrieval:**
The application automatically fetches all pages of candidates (using a limit of 100 per page for efficiency) to ensure no candidates are missed.

**Streaming Processing:**
Uses async generators to stream candidate pages as they load, starting detail processing immediately rather than waiting for all index pages to complete. This provides faster feedback and better performance for large candidate lists.

**Smart Updates:**
The application checks the `updated_at` timestamp and only downloads candidates that are new or have been updated since the last download.

**Example directory structure:**
```
candidates/
├── john.doe@example.com/
│   ├── workable-index.json
│   ├── workable-show.json
│   ├── 0-PROFILE.md
│   ├── 0-RESUME.pdf
│   └── 0-COVER.txt
└── jane.smith@company.com/
    ├── workable-index.json
    ├── workable-show.json
    ├── 0-PROFILE.md
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
