import * as fs from 'fs';
import * as path from 'path';
import { WorkableAPI } from './workable-api';
import { WorkableCandidate, WorkableCandidateDetail } from './types';

export class CandidateManager {
  private workableAPI: WorkableAPI;

  constructor(workableAPI: WorkableAPI) {
    this.workableAPI = workableAPI;
  }

  private sanitizeEmail(email: string): string {
    return email.replace(/[^a-zA-Z0-9@.-]/g, '_');
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private async getFileModificationTime(filePath: string): Promise<Date | null> {
    try {
      const stats = fs.statSync(filePath);
      return stats.mtime;
    } catch {
      return null;
    }
  }

  private async shouldUpdateCandidate(candidate: WorkableCandidate, candidateDir: string): Promise<boolean> {
    const indexFilePath = path.join(candidateDir, 'workable-index.json');
    
    if (!fs.existsSync(indexFilePath)) {
      return true;
    }

    try {
      const existingData = JSON.parse(fs.readFileSync(indexFilePath, 'utf-8'));
      const existingUpdatedAt = new Date(existingData.updated_at);
      const newUpdatedAt = new Date(candidate.updated_at);
      
      return newUpdatedAt > existingUpdatedAt;
    } catch {
      return true;
    }
  }

  async downloadCandidates(jobShortcode: string, baseDir?: string): Promise<void> {
    console.log(`Downloading candidates for job: ${jobShortcode}`);
    
    const candidatesResponse = await this.workableAPI.getCandidates(jobShortcode);
    
    for (const candidate of candidatesResponse.candidates) {
      const sanitizedEmail = this.sanitizeEmail(candidate.email);
      const candidateDir = path.join(baseDir || process.cwd(), sanitizedEmail);
      
      await this.ensureDirectoryExists(candidateDir);
      
      const shouldUpdate = await this.shouldUpdateCandidate(candidate, candidateDir);
      
      if (shouldUpdate) {
        console.log(`Updating candidate: ${candidate.email}`);
        
        const indexFilePath = path.join(candidateDir, 'workable-index.json');
        fs.writeFileSync(indexFilePath, JSON.stringify(candidate, null, 2));
        
        const candidateDetail = await this.workableAPI.getCandidateById(candidate.id);
        const showFilePath = path.join(candidateDir, 'workable-show.json');
        fs.writeFileSync(showFilePath, JSON.stringify(candidateDetail, null, 2));
        
        if (candidateDetail.resume_url) {
          try {
            const resumeBuffer = await this.workableAPI.downloadFile(candidateDetail.resume_url);
            const resumeFilePath = path.join(candidateDir, '0-RESUME.pdf');
            fs.writeFileSync(resumeFilePath, resumeBuffer);
            console.log(`  Downloaded resume for ${candidate.email}`);
          } catch (error) {
            console.warn(`  Failed to download resume for ${candidate.email}: ${error instanceof Error ? error.message : error}`);
          }
        }
        
        if (candidateDetail.cover_letter) {
          const coverLetterPath = path.join(candidateDir, '0-COVER.txt');
          fs.writeFileSync(coverLetterPath, candidateDetail.cover_letter);
          console.log(`  Saved cover letter for ${candidate.email}`);
        }
      } else {
        console.log(`Skipping candidate (up to date): ${candidate.email}`);
      }
    }
    
    console.log(`Processed ${candidatesResponse.candidates.length} candidates`);
  }
}