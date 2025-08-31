import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { WorkableAPI } from './workable-api';
import { WorkableJob, WorkableJobStage } from './types';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

export class JobManager {
  private workableAPI: WorkableAPI;

  constructor(workableAPI: WorkableAPI) {
    this.workableAPI = workableAPI;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.stat(dirPath);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }

  private generateStagesMarkdown(stages: WorkableJobStage[], jobTitle: string, shortCode: string): string {
    const sections: string[] = [];

    // Header
    sections.push(`# ${jobTitle} - Recruitment Stages`);
    sections.push(`**Job Code:** ${shortCode}\n`);

    // Stages table
    sections.push('## Recruitment Pipeline\n');
    sections.push('| Position | Stage | Type |');
    sections.push('|----------|-------|------|');
    
    stages
      .sort((a, b) => a.position - b.position)
      .forEach(stage => {
        sections.push(`| ${stage.position + 1} | ${stage.name} | ${stage.kind} |`);
      });

    sections.push(''); // Empty line after table

    // Detailed stage descriptions
    sections.push('## Stage Details\n');
    stages
      .sort((a, b) => a.position - b.position)
      .forEach(stage => {
        sections.push(`### ${stage.position + 1}. ${stage.name}`);
        sections.push(`- **Type:** ${stage.kind}`);
        sections.push(`- **Slug:** ${stage.slug}\n`);
      });

    return sections.join('\n');
  }

  async processJob(job: WorkableJob, baseDir?: string): Promise<void> {
    console.log(`Processing job: ${job.title} (${job.shortcode})`);
    
    const jobDir = path.join(baseDir || process.cwd(), 'jobs', job.shortcode);
    await this.ensureDirectoryExists(jobDir);

    // Write job index
    const jobIndexPath = path.join(jobDir, 'job-index.json');
    await writeFile(jobIndexPath, JSON.stringify(job, null, 2));

    // Get and write job stages
    try {
      const stagesResponse = await this.workableAPI.getJobStages(job.shortcode);
      
      // Write stages JSON
      const stagesJsonPath = path.join(jobDir, 'stages.json');
      await writeFile(stagesJsonPath, JSON.stringify(stagesResponse, null, 2));

      // Generate and write stages markdown
      const stagesMarkdown = this.generateStagesMarkdown(stagesResponse.stages, job.title, job.shortcode);
      const stagesMarkdownPath = path.join(jobDir, 'stages.md');
      await writeFile(stagesMarkdownPath, stagesMarkdown);

      console.log(`  Processed ${stagesResponse.stages.length} stages for ${job.title}`);
    } catch (error) {
      console.error(`  Failed to process stages for ${job.title}: ${error instanceof Error ? error.message : error}`);
    }
  }

  async processAllJobs(baseDir?: string, updatedAfter?: string): Promise<void> {
    console.log('Fetching all jobs...');
    
    const jobsResponse = await this.workableAPI.getJobs(updatedAfter);
    const jobProcessingTasks: Promise<void>[] = [];

    // Process all jobs concurrently
    for (const job of jobsResponse.jobs) {
      jobProcessingTasks.push(this.processJob(job, baseDir));
    }

    await Promise.all(jobProcessingTasks);
    
    console.log(`Processed ${jobsResponse.jobs.length} jobs`);
  }
}