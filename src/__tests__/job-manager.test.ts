import * as fs from "fs";
import * as path from "path";
import { JobManager } from "../job-manager";
import { WorkableAPI } from "../workable-api";

jest.mock("../workable-api");

const MockedWorkableAPI = WorkableAPI as jest.MockedClass<typeof WorkableAPI>;

describe("JobManager", () => {
  let jobManager: JobManager;
  let mockWorkableAPI: jest.Mocked<WorkableAPI>;
  let testDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
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

    mockWorkableAPI = {
      getJobs: jest.fn(),
      getJobStages: jest.fn(),
    } as any;

    jobManager = new JobManager(mockWorkableAPI);
  });

  describe("processJob", () => {
    const mockJob = {
      id: "job123",
      title: "Software Engineer",
      shortcode: "SE001",
      full_title: "Senior Software Engineer",
      code: "SE001",
      state: "published",
      department: "Engineering",
      url: "https://test-company.workable.com/j/SE001",
      application_url: "https://test-company.workable.com/jobs/SE001",
      shortlink: "https://test-company.workable.com/j/SE001",
      location: {
        location_str: "San Francisco, CA",
        country: "United States",
        country_code: "US",
        region: "California",
        region_code: "CA",
        city: "San Francisco",
        zip_code: "94102",
        telecommuting: false,
      },
      created_at: "2023-01-01T00:00:00Z",
    };

    const mockStages = {
      stages: [
        {
          slug: "sourced",
          name: "Sourced",
          kind: "sourced",
          position: 0,
        },
        {
          slug: "applied",
          name: "Applied",
          kind: "applied",
          position: 1,
        },
        {
          slug: "phone-interview",
          name: "Phone Interview",
          kind: "phone_interview",
          position: 2,
        },
      ],
    };

    beforeEach(() => {
      mockWorkableAPI.getJobStages.mockResolvedValue(mockStages);
    });

    it("should process a job and create all required files", async () => {
      await jobManager.processJob(mockJob, testDir);

      const jobDir = path.join(testDir, "jobs", "SE001");

      // Verify files were created
      expect(fs.existsSync(jobDir)).toBe(true);
      expect(fs.existsSync(path.join(jobDir, "job-index.json"))).toBe(true);
      expect(fs.existsSync(path.join(jobDir, "stages.json"))).toBe(true);
      expect(fs.existsSync(path.join(jobDir, "stages.md"))).toBe(true);

      // Verify file contents
      const jobIndexContent = JSON.parse(
        fs.readFileSync(path.join(jobDir, "job-index.json"), "utf-8"),
      );
      expect(jobIndexContent.title).toBe("Software Engineer");
      expect(jobIndexContent.shortcode).toBe("SE001");

      const stagesJsonContent = JSON.parse(
        fs.readFileSync(path.join(jobDir, "stages.json"), "utf-8"),
      );
      expect(stagesJsonContent.stages).toHaveLength(3);
      expect(stagesJsonContent.stages[0].name).toBe("Sourced");

      const stagesMarkdownContent = fs.readFileSync(
        path.join(jobDir, "stages.md"),
        "utf-8",
      );
      expect(stagesMarkdownContent).toContain(
        "# Software Engineer - Recruitment Stages",
      );
      expect(stagesMarkdownContent).toContain("**Job Code:** SE001");
      expect(stagesMarkdownContent).toContain("| 1 | Sourced | sourced |");
      expect(stagesMarkdownContent).toContain("| 2 | Applied | applied |");
      expect(stagesMarkdownContent).toContain(
        "| 3 | Phone Interview | phone_interview |",
      );
      expect(stagesMarkdownContent).toContain("### 1. Sourced");
      expect(stagesMarkdownContent).toContain("- **Type:** sourced");
      expect(stagesMarkdownContent).toContain("- **Slug:** sourced");
    });

    it("should handle stage fetching errors gracefully", async () => {
      mockWorkableAPI.getJobStages.mockRejectedValue(new Error("API Error"));

      await jobManager.processJob(mockJob, testDir);

      const jobDir = path.join(testDir, "jobs", "SE001");

      // Job index should still be created
      expect(fs.existsSync(path.join(jobDir, "job-index.json"))).toBe(true);

      // Stages files should not be created
      expect(fs.existsSync(path.join(jobDir, "stages.json"))).toBe(false);
      expect(fs.existsSync(path.join(jobDir, "stages.md"))).toBe(false);

      expect(console.error).toHaveBeenCalledWith(
        "  Failed to process stages for Software Engineer: API Error",
      );
    });
  });

  describe("processAllJobs", () => {
    const mockJobsResponse = {
      jobs: [
        {
          id: "job1",
          title: "Software Engineer",
          shortcode: "SE001",
          full_title: "Senior Software Engineer",
          code: "SE001",
          state: "published",
          department: "Engineering",
          url: "https://test.workable.com/j/SE001",
          application_url: "https://test.workable.com/jobs/SE001",
          shortlink: "https://test.workable.com/j/SE001",
          location: {
            location_str: "San Francisco, CA",
            country: "United States",
            country_code: "US",
            region: "California",
            region_code: "CA",
            city: "San Francisco",
            zip_code: "94102",
            telecommuting: false,
          },
          created_at: "2023-01-01T00:00:00Z",
        },
        {
          id: "job2",
          title: "Product Manager",
          shortcode: "PM001",
          full_title: "Senior Product Manager",
          code: "PM001",
          state: "published",
          department: "Product",
          url: "https://test.workable.com/j/PM001",
          application_url: "https://test.workable.com/jobs/PM001",
          shortlink: "https://test.workable.com/j/PM001",
          location: {
            location_str: "New York, NY",
            country: "United States",
            country_code: "US",
            region: "New York",
            region_code: "NY",
            city: "New York",
            zip_code: "10001",
            telecommuting: true,
          },
          created_at: "2023-01-02T00:00:00Z",
        },
      ],
      paging: { next: null },
    };

    beforeEach(() => {
      mockWorkableAPI.getJobs.mockResolvedValue(mockJobsResponse);
      mockWorkableAPI.getJobStages.mockResolvedValue({
        stages: [
          { slug: "applied", name: "Applied", kind: "applied", position: 0 },
        ],
      });
    });

    it("should process all jobs", async () => {
      await jobManager.processAllJobs(testDir);

      expect(mockWorkableAPI.getJobs).toHaveBeenCalledTimes(1);
      expect(mockWorkableAPI.getJobs).toHaveBeenCalledWith(undefined);
      expect(mockWorkableAPI.getJobStages).toHaveBeenCalledTimes(2);
      expect(mockWorkableAPI.getJobStages).toHaveBeenCalledWith("SE001");
      expect(mockWorkableAPI.getJobStages).toHaveBeenCalledWith("PM001");

      // Verify both job directories were created
      expect(fs.existsSync(path.join(testDir, "jobs", "SE001"))).toBe(true);
      expect(fs.existsSync(path.join(testDir, "jobs", "PM001"))).toBe(true);

      expect(console.log).toHaveBeenCalledWith("Processed 2 jobs");
    });
  });
});
