# Wable

A TypeScript command-line application for interacting with the Workable API to download candidate information.

## Features

- **Job Listings**: Fetch and display available jobs from your Workable account
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

This application uses the [Workable API v3](https://workable.readme.io/reference/jobs) to fetch job information.

## Testing

The application includes comprehensive unit tests covering:
- Workable API client functionality
- CLI option parsing and execution
- Error handling for network and API errors

Run tests with:
```bash
yarn test
```
