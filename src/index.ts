#!/usr/bin/env node

import { Command } from "commander";
import { WorkableAPI } from "./workable-api";
import { CandidateManager } from "./candidate-manager";
import { JobManager } from "./job-manager";

const program = new Command();

program.name("wable").description("CLI tool for Workable API").version("1.0.0");

program
  .option("--get-jobs", "Process all jobs and download stages information")
  .option("--get-candidates", "Download candidates for a specific job")
  .option(
    "--shortcode <jobShortcode>",
    "Job shortcode (required when using --get-candidates)",
  )
  .option(
    "--updated-after <date>",
    "Filter jobs/candidates updated after this date (ISO format)",
  )
  .option(
    "--move-disqualified-candidates-to <directory>",
    "Move disqualified candidates to specified directory",
  )
  .option("--subdomain <subdomain>", "Workable subdomain")
  .option("--token <token>", "Workable API token")
  .option(
    "--base-dir <baseDir>",
    "Base directory for outputs (default: current directory)",
  )
  .action(async (options) => {
    if (!options.subdomain || !options.token) {
      console.error("Error: --subdomain and --token are required");
      process.exit(1);
    }

    const workableAPI = new WorkableAPI(options.subdomain, options.token);

    if (options.getJobs) {
      try {
        const jobManager = new JobManager(workableAPI);
        await jobManager.processAllJobs(options.baseDir, options.updatedAfter);
      } catch (error) {
        console.error(
          "Error processing jobs:",
          error instanceof Error ? error.message : error,
        );
        process.exit(1);
      }
    }

    if (options.getCandidates) {
      if (!options.shortcode) {
        console.error(
          "Error: --shortcode is required when using --get-candidates",
        );
        process.exit(1);
      }

      try {
        const candidateManager = new CandidateManager(workableAPI);
        await candidateManager.downloadCandidates(
          options.shortcode,
          options.baseDir,
          options.updatedAfter,
        );
      } catch (error) {
        console.error("Error downloading candidates:", error);
        process.exit(1);
      }
    }

    if (options.moveDisqualifiedCandidatesTo) {
      try {
        const candidateManager = new CandidateManager(workableAPI);
        await candidateManager.moveDisqualifiedCandidates(
          options.baseDir || process.cwd(),
          options.moveDisqualifiedCandidatesTo,
        );
      } catch (error) {
        console.error(
          "Error moving disqualified candidates:",
          error instanceof Error ? error.message : error,
        );
        process.exit(1);
      }
    }
  });

program.parse();
