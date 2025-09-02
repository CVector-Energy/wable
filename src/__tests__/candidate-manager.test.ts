import * as fs from "fs";
import * as path from "path";
import { CandidateManager } from "../candidate-manager";
import { WorkableAPI } from "../workable-api";

jest.mock("../workable-api");

describe("CandidateManager", () => {
  let candidateManager: CandidateManager;
  const mockWorkableAPI = new WorkableAPI("", "") as jest.Mocked<WorkableAPI>;
  let testDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();

    // Create unique test directory with test name for better clarity
    const timestamp = Date.now();
    const testName =
      expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") ||
      "unknown";
    testDir = path.join(
      process.cwd(),
      "var",
      "jest",
      testName,
      timestamp.toString(),
    );
    fs.mkdirSync(testDir, { recursive: true });

    mockWorkableAPI.getCandidates = jest.fn();
    mockWorkableAPI.generateCandidates = jest.fn();
    mockWorkableAPI.getCandidateById = jest.fn();
    mockWorkableAPI.downloadFile = jest.fn();

    candidateManager = new CandidateManager(mockWorkableAPI);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("downloadCandidates", () => {
    const mockCandidate = {
      id: "candidate123",
      email: "john.doe@example.com",
      name: "John Doe",
      updated_at: "2023-12-01T10:00:00Z",
      firstname: "John",
      lastname: "Doe",
      headline: "Software Engineer",
      account: { subdomain: "test", name: "Test Company" },
      job: { shortcode: "SE001", title: "Software Engineer" },
      stage: "sourced",
      disqualified: false,
      disqualification_reason: null,
      hired_at: null,
      sourced: true,
      profile_url: "https://test.workable.com/candidate/123",
      address: "123 Main St",
      phone: "555-1234",
      domain: "example.com",
      created_at: "2023-11-01T10:00:00Z",
      resume_url: "https://example.com/resume.pdf",
      cover_letter: "I am interested in this position...",
    };

    const mockCandidateDetail = {
      ...mockCandidate,
      image_url: null,
      summary: "Experienced software engineer",
      experience_entries: [
        {
          title: "Senior Developer",
          company: "Tech Corp",
          industry: "Technology",
          summary: "Led development team",
          start_date: "2022-01-01",
          end_date: null,
          current: true,
        },
        {
          title: "Java Developer",
          company: "Partners Soft",
          industry: null,
          summary: "Worked on enterprise applications",
          start_date: "2024-10-01",
          end_date: "2025-03-01",
          current: false,
        },
      ],
      education_entries: [],
      skills: ["JavaScript", "TypeScript"],
      tags: [],
      social_profiles: [],
      attachments: [],
      answers: [],
      location: {
        country: "United States",
        country_code: "US",
        region: "California",
        region_code: "CA",
        city: "San Francisco",
        zip_code: "94102",
        telecommuting: false,
      },
      stage_kind: "sourced",
      withdrew: false,
    };

    beforeEach(() => {
      // Mock the async generator behavior
      mockWorkableAPI.generateCandidates.mockImplementation(async function* () {
        yield [mockCandidate];
      });

      mockWorkableAPI.getCandidateById.mockResolvedValue(mockCandidateDetail);
      mockWorkableAPI.downloadFile.mockResolvedValue(
        Buffer.from("PDF content"),
      );
    });

    it("should download new candidates", async () => {
      await candidateManager.downloadCandidates("SE001", testDir);

      expect(mockWorkableAPI.generateCandidates).toHaveBeenCalledWith(
        "SE001",
        undefined,
      );
      expect(mockWorkableAPI.getCandidateById).toHaveBeenCalledWith(
        "candidate123",
      );
      expect(mockWorkableAPI.downloadFile).toHaveBeenCalledWith(
        "https://example.com/resume.pdf",
      );

      // Verify files were created
      const candidateDir = path.join(
        testDir,
        "candidates",
        "john.doe@example.com",
      );
      expect(fs.existsSync(candidateDir)).toBe(true);
      expect(
        fs.existsSync(path.join(candidateDir, "workable-index.json")),
      ).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, "workable-show.json"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(candidateDir, "0-PROFILE.md"))).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, "0-RESUME.pdf"))).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, "0-COVER.txt"))).toBe(true);

      // Verify file contents
      const indexContent = JSON.parse(
        fs.readFileSync(
          path.join(candidateDir, "workable-index.json"),
          "utf-8",
        ),
      );
      expect(indexContent.email).toBe("john.doe@example.com");

      const showContent = JSON.parse(
        fs.readFileSync(path.join(candidateDir, "workable-show.json"), "utf-8"),
      );
      expect(showContent.skills).toEqual(["JavaScript", "TypeScript"]);

      const profileContent = fs.readFileSync(
        path.join(candidateDir, "0-PROFILE.md"),
        "utf-8",
      );
      expect(profileContent).toContain("# John Doe");
      expect(profileContent).toContain("📧 john.doe@example.com");

      // Verify experience entries are formatted correctly
      expect(profileContent).toContain(
        "### Senior Developer at Tech Corp\n**Dec 2021 - Present** | Technology",
      );
      expect(profileContent).toContain(
        "### Java Developer at Partners Soft\n**Sep 2024 - Feb 2025**\n",
      ); // No industry shown
      expect(profileContent).not.toContain("| null"); // Should never show "| null"

      const resumeContent = fs.readFileSync(
        path.join(candidateDir, "0-RESUME.pdf"),
      );
      expect(resumeContent).toEqual(Buffer.from("PDF content"));

      const coverContent = fs.readFileSync(
        path.join(candidateDir, "0-COVER.txt"),
        "utf-8",
      );
      expect(coverContent).toBe("I am interested in this position...");
    });

    it("should skip candidates that are up to date", async () => {
      // Pre-create candidate directory with existing data that's newer
      const candidateDir = path.join(
        testDir,
        "candidates",
        "john.doe@example.com",
      );
      fs.mkdirSync(candidateDir, { recursive: true });

      const existingData = {
        ...mockCandidate,
        updated_at: "2023-12-01T12:00:00Z",
      };
      fs.writeFileSync(
        path.join(candidateDir, "workable-index.json"),
        JSON.stringify(existingData, null, 2),
      );

      await candidateManager.downloadCandidates("SE001", testDir);

      expect(mockWorkableAPI.generateCandidates).toHaveBeenCalledWith(
        "SE001",
        undefined,
      );
      expect(mockWorkableAPI.getCandidateById).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "Skipping candidate (up to date): john.doe@example.com",
      );
    });

    it("should handle candidates without resume or cover letter", async () => {
      const candidateWithoutFiles = {
        ...mockCandidate,
        resume_url: null,
        cover_letter: null,
      };

      const candidateDetailWithoutFiles = {
        ...mockCandidateDetail,
        resume_url: null,
        cover_letter: null,
      };

      mockWorkableAPI.generateCandidates.mockImplementation(async function* () {
        yield [candidateWithoutFiles];
      });

      mockWorkableAPI.getCandidateById.mockResolvedValue(
        candidateDetailWithoutFiles,
      );

      await candidateManager.downloadCandidates("SE001", testDir);

      expect(mockWorkableAPI.downloadFile).not.toHaveBeenCalled();

      // Verify only the files that should exist are created
      const candidateDir = path.join(
        testDir,
        "candidates",
        "john.doe@example.com",
      );
      expect(
        fs.existsSync(path.join(candidateDir, "workable-index.json")),
      ).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, "workable-show.json"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(candidateDir, "0-PROFILE.md"))).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, "0-RESUME.pdf"))).toBe(
        false,
      );
      expect(fs.existsSync(path.join(candidateDir, "0-COVER.txt"))).toBe(false);
    });
  });

  describe("moveDisqualifiedCandidates", () => {
    const qualifiedCandidate = {
      id: "qualified123",
      email: "qualified@example.com",
      name: "Qualified Doe",
      updated_at: "2023-12-01T10:00:00Z",
      disqualified: false,
      firstname: "Qualified",
      lastname: "Doe",
      headline: "Software Engineer",
      account: { subdomain: "test", name: "Test Company" },
      job: { shortcode: "SE001", title: "Software Engineer" },
      stage: "sourced",
      disqualification_reason: null,
      hired_at: null,
      sourced: true,
      profile_url: "https://test.workable.com/candidate/qualified123",
      address: "123 Main St",
      phone: "555-1234",
      domain: "example.com",
      created_at: "2023-11-01T10:00:00Z",
      resume_url: null,
      cover_letter: null,
    };

    const disqualifiedCandidate = {
      ...qualifiedCandidate,
      id: "disqualified123",
      email: "disqualified@example.com",
      name: "Disqualified Doe",
      firstname: "Disqualified",
      disqualified: true,
      disqualification_reason: "Not a good fit",
    };

    beforeEach(() => {
      // Create test candidates directory structure
      const candidatesDir = path.join(testDir, "candidates");
      fs.mkdirSync(candidatesDir, { recursive: true });

      // Create qualified candidate
      const qualifiedCandidateDir = path.join(
        candidatesDir,
        "qualified@example.com",
      );
      fs.mkdirSync(qualifiedCandidateDir);
      fs.writeFileSync(
        path.join(qualifiedCandidateDir, "workable-index.json"),
        JSON.stringify(qualifiedCandidate, null, 2),
      );
      fs.writeFileSync(
        path.join(qualifiedCandidateDir, "0-PROFILE.md"),
        "# Qualified Candidate",
      );

      // Create disqualified candidate
      const disqualifiedCandidateDir = path.join(
        candidatesDir,
        "disqualified@example.com",
      );
      fs.mkdirSync(disqualifiedCandidateDir);
      fs.writeFileSync(
        path.join(disqualifiedCandidateDir, "workable-index.json"),
        JSON.stringify(disqualifiedCandidate, null, 2),
      );
      fs.writeFileSync(
        path.join(disqualifiedCandidateDir, "0-PROFILE.md"),
        "# Disqualified Candidate",
      );
      fs.writeFileSync(
        path.join(disqualifiedCandidateDir, "0-RESUME.pdf"),
        "PDF content",
      );
    });

    it("should move disqualified candidates to destination directory", async () => {
      const moveToDir = path.join(testDir, "disqualified");

      await candidateManager.moveDisqualifiedCandidates(testDir, moveToDir);

      // Verify qualified candidate stays in original location
      const qualifiedDir = path.join(
        testDir,
        "candidates",
        "qualified@example.com",
      );
      expect(fs.existsSync(qualifiedDir)).toBe(true);
      expect(
        fs.existsSync(path.join(qualifiedDir, "workable-index.json")),
      ).toBe(true);

      // Verify disqualified candidate was moved
      const originalDisqualifiedDir = path.join(
        testDir,
        "candidates",
        "disqualified@example.com",
      );
      const movedDisqualifiedDir = path.join(
        moveToDir,
        "disqualified@example.com",
      );

      expect(fs.existsSync(originalDisqualifiedDir)).toBe(false); // Should be removed from original location
      expect(fs.existsSync(movedDisqualifiedDir)).toBe(true); // Should exist in new location
      expect(
        fs.existsSync(path.join(movedDisqualifiedDir, "workable-index.json")),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(movedDisqualifiedDir, "0-PROFILE.md")),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(movedDisqualifiedDir, "0-RESUME.pdf")),
      ).toBe(true);

      // Verify content is preserved
      const movedData = JSON.parse(
        fs.readFileSync(
          path.join(movedDisqualifiedDir, "workable-index.json"),
          "utf-8",
        ),
      );
      expect(movedData.email).toBe("disqualified@example.com");
      expect(movedData.disqualified).toBe(true);
    });

    it("should overwrite existing files in destination", async () => {
      const moveToDir = path.join(testDir, "disqualified");

      // Pre-create destination with existing candidate
      fs.mkdirSync(path.join(moveToDir, "disqualified@example.com"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(moveToDir, "disqualified@example.com", "old-file.txt"),
        "Old content",
      );
      fs.writeFileSync(
        path.join(moveToDir, "disqualified@example.com", "workable-index.json"),
        '{"old": "data"}',
      );

      await candidateManager.moveDisqualifiedCandidates(testDir, moveToDir);

      const movedDir = path.join(moveToDir, "disqualified@example.com");

      // Old file should still exist
      expect(fs.existsSync(path.join(movedDir, "old-file.txt"))).toBe(true);

      // New files should be present and overwrite existing ones
      const movedData = JSON.parse(
        fs.readFileSync(path.join(movedDir, "workable-index.json"), "utf-8"),
      );
      expect(movedData.email).toBe("disqualified@example.com");
      expect(movedData.disqualified).toBe(true);
      expect(movedData.old).toBeUndefined(); // Old data should be overwritten
    });

    it("should handle missing candidates directory gracefully", async () => {
      const emptyTestDir = path.join(testDir, "empty");
      fs.mkdirSync(emptyTestDir);
      const moveToDir = path.join(testDir, "disqualified");

      await candidateManager.moveDisqualifiedCandidates(
        emptyTestDir,
        moveToDir,
      );

      expect(console.log).toHaveBeenCalledWith("No candidates directory found");
    });

    it("should handle candidates with invalid JSON gracefully", async () => {
      const candidatesDir = path.join(testDir, "candidates");

      // Create candidate with invalid JSON
      const invalidCandidateDir = path.join(
        candidatesDir,
        "invalid@example.com",
      );
      fs.mkdirSync(invalidCandidateDir);
      fs.writeFileSync(
        path.join(invalidCandidateDir, "workable-index.json"),
        "invalid json",
      );

      const moveToDir = path.join(testDir, "disqualified");

      await candidateManager.moveDisqualifiedCandidates(testDir, moveToDir);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to process candidate invalid@example.com",
        ),
      );
    });
  });
});
