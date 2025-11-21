import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { WorkableAPI } from "./workable-api";
import { WorkableCandidate, WorkableCandidateDetail } from "./types";

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

export class CandidateManager {
  private workableAPI: WorkableAPI;

  constructor(workableAPI: WorkableAPI) {
    this.workableAPI = workableAPI;
  }

  private sanitizeEmail(email: string): string {
    return email.replace(/[^a-zA-Z0-9@.-]/g, "_");
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await stat(dirPath);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }

  private async shouldUpdateCandidate(
    candidate: WorkableCandidate,
    candidateDir: string,
  ): Promise<boolean> {
    const indexFilePath = path.join(candidateDir, "workable-index.json");

    try {
      const existingData = JSON.parse(await readFile(indexFilePath, "utf-8"));
      const existingUpdatedAt = new Date(existingData.updated_at);
      const newUpdatedAt = new Date(candidate.updated_at);

      return newUpdatedAt > existingUpdatedAt;
    } catch {
      return true;
    }
  }

  private generateMarkdownProfile(candidate: WorkableCandidateDetail): string {
    const formatDate = (dateStr: string | null): string => {
      if (!dateStr) return "Present";
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        timeZone: "UTC",
      });
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
      contactInfo.push(
        `🌍 ${candidate.location.city}, ${candidate.location.country}`,
      );
    }

    if (contactInfo.length > 0) {
      sections.push("## Contact Information\n" + contactInfo.join("\n"));
    }

    // Job Application
    sections.push("## Application Details");
    sections.push(
      `**Position:** ${candidate.job.title} (${candidate.job.shortcode})`,
    );
    sections.push(`**Stage:** ${candidate.stage}`);
    sections.push(`**Applied:** ${formatDate(candidate.created_at)}`);
    if (candidate.sourced) sections.push("**Source:** Sourced candidate");

    // Summary
    if (candidate.summary) {
      sections.push("## Summary\n" + candidate.summary);
    }

    // Skills
    if (candidate.skills && candidate.skills.length > 0) {
      sections.push(
        "## Skills\n" +
          candidate.skills.map((skill) => `- ${skill}`).join("\n"),
      );
    }

    // Experience
    if (
      candidate.experience_entries &&
      candidate.experience_entries.length > 0
    ) {
      sections.push("## Work Experience");
      candidate.experience_entries.forEach((exp) => {
        const duration = `${formatDate(exp.start_date)} - ${exp.current ? "Present" : formatDate(exp.end_date)}`;
        const industryText = exp.industry ? ` | ${exp.industry}` : "";
        sections.push(
          `### ${exp.title} at ${exp.company}\n**${duration}**${industryText}\n\n${exp.summary || ""}`,
        );
      });
    }

    // Education
    if (candidate.education_entries && candidate.education_entries.length > 0) {
      sections.push("## Education");
      candidate.education_entries.forEach((edu) => {
        const duration = `${formatDate(edu.start_date)} - ${formatDate(edu.end_date)}`;
        sections.push(
          `### ${edu.degree}\n**${edu.school}** | ${edu.field_of_study}\n*${duration}*`,
        );
      });
    }

    // Social Profiles
    if (candidate.social_profiles && candidate.social_profiles.length > 0) {
      sections.push("## Social Profiles");
      candidate.social_profiles.forEach((profile) => {
        sections.push(
          `- **${profile.type}:** [${profile.name}](${profile.url})`,
        );
      });
    }

    // Tags
    if (candidate.tags && candidate.tags.length > 0) {
      sections.push(
        "## Tags\n" + candidate.tags.map((tag) => `\`${tag}\``).join(" "),
      );
    }

    // Cover Letter
    if (candidate.cover_letter) {
      sections.push("## Cover Letter\n" + candidate.cover_letter);
    }

    return sections.join("\n\n");
  }

  private async processCandidateDetails(
    candidate: WorkableCandidate,
    candidateDir: string,
  ): Promise<void> {
    try {
      console.log(`Processing details for ${candidate.email}`);

      const candidateDetail = await this.workableAPI.getCandidateById(
        candidate.id,
      );
      const showFilePath = path.join(candidateDir, "workable-show.json");
      await writeFile(showFilePath, JSON.stringify(candidateDetail, null, 2));

      // Generate markdown profile
      const markdownProfile = this.generateMarkdownProfile(candidateDetail);
      const profileFilePath = path.join(candidateDir, "0-PROFILE.md");
      await writeFile(profileFilePath, markdownProfile);
      console.log(`  Generated profile for ${candidate.email}`);

      // Download resume from candidate details (this is from S3 and doesn't count against API quota)
      if (candidateDetail.resume_url) {
        try {
          const resumeBuffer = await this.workableAPI.downloadFile(
            candidateDetail.resume_url,
          );
          const resumeFilePath = path.join(candidateDir, "0-RESUME.pdf");
          await writeFile(resumeFilePath, resumeBuffer);
          console.log(`  Downloaded resume for ${candidate.email}`);
        } catch (error) {
          console.warn(
            `  Failed to download resume for ${candidate.email}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      if (candidateDetail.cover_letter) {
        const coverLetterPath = path.join(candidateDir, "0-COVER.txt");
        await writeFile(coverLetterPath, candidateDetail.cover_letter);
        console.log(`  Saved cover letter for ${candidate.email}`);
      }
    } catch (error) {
      console.error(
        `  Failed to process details for ${candidate.email}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async downloadCandidates(
    jobShortcode: string,
    baseDir?: string,
    updatedAfter?: string,
  ): Promise<void> {
    console.log(`Downloading candidates for job: ${jobShortcode}`);

    const detailJobs: Promise<void>[] = [];
    let totalCandidates = 0;

    // Process candidates as each page loads using async generator
    for await (const candidates of this.workableAPI.generateCandidates(
      jobShortcode,
      updatedAfter,
    )) {
      for (const candidate of candidates) {
        const sanitizedEmail = this.sanitizeEmail(
          candidate.email || candidate.id,
        );
        const candidateDir = path.join(
          baseDir || process.cwd(),
          "candidates",
          sanitizedEmail,
        );

        await this.ensureDirectoryExists(candidateDir);

        const shouldUpdate = await this.shouldUpdateCandidate(
          candidate,
          candidateDir,
        );

        if (shouldUpdate) {
          console.log(`Updating candidate: ${candidate.email}`);

          // Write index file immediately
          const indexFilePath = path.join(candidateDir, "workable-index.json");
          await writeFile(indexFilePath, JSON.stringify(candidate, null, 2));

          // Queue the detail processing job
          detailJobs.push(
            this.processCandidateDetails(candidate, candidateDir),
          );
        } else {
          console.log(`Skipping candidate (up to date): ${candidate.email}`);
        }

        totalCandidates++;
      }
    }

    // Wait for all detail processing to complete
    console.log(`Processing details for ${detailJobs.length} candidates...`);
    await Promise.all(detailJobs);

    console.log(`Processed ${totalCandidates} candidates`);
  }

  async moveDisqualifiedCandidates(
    baseDir: string,
    moveToDir: string,
  ): Promise<void> {
    console.log(
      `Moving disqualified candidates from ${baseDir} to ${moveToDir}`,
    );

    const candidatesDir = path.join(baseDir, "candidates");

    // Check if candidates directory exists
    try {
      await stat(candidatesDir);
    } catch {
      console.log("No candidates directory found");
      return;
    }

    // Ensure move-to directory exists
    await this.ensureDirectoryExists(moveToDir);

    // Read all candidate directories
    const candidateEntries = await fs.promises.readdir(candidatesDir, {
      withFileTypes: true,
    });
    const candidateDirs = candidateEntries.filter((entry) =>
      entry.isDirectory(),
    );

    let movedCount = 0;

    for (const candidateDir of candidateDirs) {
      const candidateDirPath = path.join(candidatesDir, candidateDir.name);
      const indexFilePath = path.join(candidateDirPath, "workable-index.json");

      try {
        // Read candidate metadata
        const candidateData = JSON.parse(
          await readFile(indexFilePath, "utf-8"),
        );

        // Check if candidate is disqualified
        if (candidateData.disqualified === true) {
          console.log(`Moving disqualified candidate: ${candidateDir.name}`);

          // Create destination directory
          const destinationDir = path.join(moveToDir, candidateDir.name);
          await this.ensureDirectoryExists(destinationDir);

          // Move all files from source to destination
          await this.moveDirectory(candidateDirPath, destinationDir);

          movedCount++;
        }
      } catch (error) {
        console.warn(
          `Failed to process candidate ${candidateDir.name}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    console.log(`Moved ${movedCount} disqualified candidates`);
  }

  private async moveDirectory(
    sourceDir: string,
    destinationDir: string,
  ): Promise<void> {
    // Read all files in source directory
    const files = await fs.promises.readdir(sourceDir);

    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const destinationPath = path.join(destinationDir, file);

      // Copy file to destination (overwrites if exists)
      await fs.promises.copyFile(sourcePath, destinationPath);
    }

    // Remove source directory
    await fs.promises.rm(sourceDir, { recursive: true });
  }
}
