import { Command } from "commander";
import { WorkableAPI } from "../workable-api";

jest.mock("../workable-api");
const MockedWorkableAPI = WorkableAPI as jest.MockedClass<typeof WorkableAPI>;

describe("CLI Application", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
    jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should display jobs when --get-jobs is used with valid credentials", async () => {
    const mockGetJobs = jest.fn().mockResolvedValue({
      jobs: [
        { title: "Software Engineer", shortcode: "SE001" },
        { title: "Product Manager", shortcode: "PM001" },
      ],
      paging: { next: null },
    });

    MockedWorkableAPI.prototype.getJobs = mockGetJobs;

    const program = new Command();

    process.argv = [
      "node",
      "wable",
      "--get-jobs",
      "--subdomain",
      "test",
      "--token",
      "token123",
    ];

    await new Promise((resolve) => {
      program
        .option("--get-jobs", "Get available jobs from Workable")
        .option("--subdomain <subdomain>", "Workable subdomain")
        .option("--token <token>", "Workable API token")
        .action(async (options) => {
          if (options.getJobs) {
            const workableAPI = new WorkableAPI(
              options.subdomain,
              options.token,
            );
            const response = await workableAPI.getJobs();

            console.log("Available Jobs:");
            response.jobs.forEach((job) => {
              console.log(`${job.title} (${job.shortcode})`);
            });
          }
          resolve(void 0);
        });

      program.parse();
    });

    expect(MockedWorkableAPI).toHaveBeenCalledWith("test", "token123");
    expect(mockGetJobs).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("Available Jobs:");
    expect(console.log).toHaveBeenCalledWith("Software Engineer (SE001)");
    expect(console.log).toHaveBeenCalledWith("Product Manager (PM001)");
  });
});
