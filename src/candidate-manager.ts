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

  private generateMarkdownProfile(candidate: WorkableCandidateDetail): string {
    console.log("generateMarkdownProfile", candidate.job);
    const formatDate = (dateStr: string | null): string => {
      if (!dateStr) return 'Present';
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    };

    const sections: string[] = [];

    // Header
    sections.push(`# ${candidate.name}`);
    
    if (candidate.headline) {
      sections.push(`**${candidate.headline}**`);
    }

    // Contact Information
    const contactInfo: string[] = [];
    if (candidate.email) contactInfo.push(`📧 ${candidate.email}`);
    if (candidate.phone) contactInfo.push(`📞 ${candidate.phone}`);
    if (candidate.address) contactInfo.push(`📍 ${candidate.address}`);
    if (candidate.location?.city && candidate.location?.country) {
      contactInfo.push(`🌍 ${candidate.location.city}, ${candidate.location.country}`);
    }
    
    if (contactInfo.length > 0) {
      sections.push('## Contact Information\n' + contactInfo.join('\n'));
    }

    // Job Application
    sections.push('## Application Details');
    sections.push(`**Position:** ${candidate.job.title} (${candidate.job.shortcode})`);
    sections.push(`**Stage:** ${candidate.stage}`);
    sections.push(`**Applied:** ${formatDate(candidate.created_at)}`);
    if (candidate.sourced) sections.push('**Source:** Sourced candidate');

    // Summary
    if (candidate.summary) {
      sections.push('## Summary\n' + candidate.summary);
    }

    // Skills
    if (candidate.skills && candidate.skills.length > 0) {
      sections.push('## Skills\n' + candidate.skills.map(skill => `- ${skill}`).join('\n'));
    }

    // Experience
    if (candidate.experience_entries && candidate.experience_entries.length > 0) {
      sections.push('## Work Experience');
      candidate.experience_entries.forEach(exp => {
        const duration = `${formatDate(exp.start_date)} - ${exp.current ? 'Present' : formatDate(exp.end_date)}`;
        sections.push(`### ${exp.title} at ${exp.company}\n**${duration}** | ${exp.industry}\n\n${exp.summary || ''}`);
      });
    }

    // Education
    if (candidate.education_entries && candidate.education_entries.length > 0) {
      sections.push('## Education');
      candidate.education_entries.forEach(edu => {
        const duration = `${formatDate(edu.start_date)} - ${formatDate(edu.end_date)}`;
        sections.push(`### ${edu.degree}\n**${edu.school}** | ${edu.field_of_study}\n*${duration}*`);
      });
    }

    // Social Profiles
    if (candidate.social_profiles && candidate.social_profiles.length > 0) {
      sections.push('## Social Profiles');
      candidate.social_profiles.forEach(profile => {
        sections.push(`- **${profile.type}:** [${profile.name}](${profile.url})`);
      });
    }

    // Tags
    if (candidate.tags && candidate.tags.length > 0) {
      sections.push('## Tags\n' + candidate.tags.map(tag => `\`${tag}\``).join(' '));
    }

    // Cover Letter
    if (candidate.cover_letter) {
      sections.push('## Cover Letter\n' + candidate.cover_letter);
    }

    return sections.join('\n\n');
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
        
        // Generate markdown profile
        const markdownProfile = this.generateMarkdownProfile(candidateDetail);
        const profileFilePath = path.join(candidateDir, '0-PROFILE.md');
        fs.writeFileSync(profileFilePath, markdownProfile);
        console.log(`  Generated profile for ${candidate.email}`);
        
        // Download resume from candidate details (this is from S3 and doesn't count against API quota)
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