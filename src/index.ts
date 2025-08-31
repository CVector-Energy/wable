#!/usr/bin/env node

import { Command } from 'commander';
import { WorkableAPI } from './workable-api';
import { CandidateManager } from './candidate-manager';

const program = new Command();

program
  .name('wable')
  .description('CLI tool for Workable API')
  .version('1.0.0');

program
  .option('--get-jobs', 'Get available jobs from Workable')
  .option('--get-candidates <jobShortcode>', 'Download candidates for a specific job')
  .option('--subdomain <subdomain>', 'Workable subdomain')
  .option('--token <token>', 'Workable API token')
  .option('--base-dir <baseDir>', 'Base directory for candidate subdirectories (default: current directory)')
  .action(async (options) => {
    if (!options.subdomain || !options.token) {
      console.error('Error: --subdomain and --token are required');
      process.exit(1);
    }

    const workableAPI = new WorkableAPI(options.subdomain, options.token);

    if (options.getJobs) {
      try {
        const response = await workableAPI.getJobs();
        
        console.log('Available Jobs:');
        response.jobs.forEach((job) => {
          console.log(`${job.title} (${job.shortcode})`);
        });
      } catch (error) {
        console.error('Error fetching jobs:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    }

    if (options.getCandidates) {
      try {
        const candidateManager = new CandidateManager(workableAPI);
        await candidateManager.downloadCandidates(options.getCandidates, options.baseDir);
      } catch (error) {
        console.error('Error downloading candidates:', error);
        process.exit(1);
      }
    }
  });

program.parse();