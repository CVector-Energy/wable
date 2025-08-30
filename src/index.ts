#!/usr/bin/env node

import { Command } from 'commander';
import { WorkableAPI } from './workable-api';

const program = new Command();

program
  .name('wable')
  .description('CLI tool for Workable API')
  .version('1.0.0');

program
  .option('--get-jobs', 'Get available jobs from Workable')
  .option('--subdomain <subdomain>', 'Workable subdomain')
  .option('--token <token>', 'Workable API token')
  .action(async (options) => {
    if (options.getJobs) {
      if (!options.subdomain || !options.token) {
        console.error('Error: --subdomain and --token are required when using --get-jobs');
        process.exit(1);
      }

      try {
        const workableAPI = new WorkableAPI(options.subdomain, options.token);
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
  });

program.parse();