import axios, { RawAxiosResponseHeaders, AxiosResponseHeaders } from "axios";
import {
  WorkableCandidate,
  WorkableJobsResponse,
  WorkableCandidatesResponse,
  WorkableCandidateDetail,
  WorkableJobStagesResponse,
} from "./types";

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
}

export class WorkableAPI {
  private baseUrl: string;
  private apiToken: string;
  private rateLimitInfo: RateLimitInfo | null = null;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  constructor(subdomain: string, apiToken: string) {
    this.baseUrl = `https://${subdomain}.workable.com/spi/v3`;
    this.apiToken = apiToken;
  }

  private updateRateLimitInfo(
    headers: RawAxiosResponseHeaders | AxiosResponseHeaders,
  ): void {
    this.rateLimitInfo = {
      limit: parseInt(headers["x-rate-limit-limit"] || "10", 10),
      remaining: parseInt(headers["x-rate-limit-remaining"] || "10", 10),
      resetTime: parseInt(headers["x-rate-limit-reset"] || "0", 10),
    };
  }

  private async waitForRateLimit(): Promise<void> {
    if (!this.rateLimitInfo) return;

    if (this.rateLimitInfo.remaining <= 1) {
      const now = Date.now() / 1000;
      const waitTime = Math.max(0, this.rateLimitInfo.resetTime - now) * 1000;

      if (waitTime > 0) {
        console.log(
          `Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime + 1000)); // Add 1s buffer
      }
    }
  }

  private async makeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          await this.waitForRateLimit();
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      await request();

      // Add a small delay between requests to be conservative
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  async getJobs(updatedAfter?: string): Promise<WorkableJobsResponse> {
    return this.makeRequest(async () => {
      const params = new URLSearchParams();
      if (updatedAfter) {
        params.append("updated_after", updatedAfter);
      }

      const url = `${this.baseUrl}/jobs${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      });
      this.updateRateLimitInfo(response.headers);
      return response.data;
    });
  }

  async getCandidates(
    jobShortcode: string,
    updatedAfter?: string,
  ): Promise<WorkableCandidatesResponse> {
    const allCandidates: any[] = [];
    let nextUrl: string | null = null;

    const params = new URLSearchParams();
    params.append("limit", "100"); // maximum page size
    if (updatedAfter) {
      params.append("updated_after", updatedAfter);
    }

    const initialUrl = `${this.baseUrl}/jobs/${jobShortcode}/candidates?${params.toString()}`;
    nextUrl = initialUrl;

    // Fetch all pages
    while (nextUrl) {
      const pageResponse = await this.makeRequest(async () => {
        const response = await axios.get(nextUrl!, {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        });
        this.updateRateLimitInfo(response.headers);
        return response.data;
      });

      // Add candidates from this page
      allCandidates.push(...pageResponse.candidates);

      // Check if there's a next page
      nextUrl = pageResponse.paging?.next || null;

      if (nextUrl) {
        console.log(
          `Fetched ${pageResponse.candidates.length} candidates, continuing to next page...`,
        );
      }
    }

    console.log(
      `Fetched total of ${allCandidates.length} candidates across all pages`,
    );

    // Return combined result in the same format as the original response
    return {
      candidates: allCandidates,
      paging: { next: null }, // No next page since we fetched all
    };
  }

  async *generateCandidates(
    jobShortcode: string,
    updatedAfter?: string,
  ): AsyncGenerator<WorkableCandidate[], void, unknown> {
    let nextUrl: string | null = null;

    const params = new URLSearchParams();
    params.append("limit", "100"); // maximum page size
    if (updatedAfter) {
      params.append("updated_after", updatedAfter);
    }

    const initialUrl = `${this.baseUrl}/jobs/${jobShortcode}/candidates?${params.toString()}`;
    nextUrl = initialUrl;

    // Fetch all pages and yield each page as it loads
    while (nextUrl) {
      const pageResponse = await this.makeRequest(async () => {
        const response = await axios.get(nextUrl!, {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        });
        this.updateRateLimitInfo(response.headers);
        return response.data;
      });

      // Yield this page of candidates
      if (pageResponse.candidates.length > 0) {
        yield pageResponse.candidates;
      }

      // Check if there's a next page
      nextUrl = pageResponse.paging?.next || null;

      if (nextUrl) {
        console.log(
          `Fetched ${pageResponse.candidates.length} candidates, continuing to next page...`,
        );
      }
    }
  }

  async getCandidateById(
    candidateId: string,
  ): Promise<WorkableCandidateDetail> {
    return this.makeRequest(async () => {
      const response = await axios.get(
        `${this.baseUrl}/candidates/${candidateId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      this.updateRateLimitInfo(response.headers);
      return response.data.candidate;
    });
  }

  async getJobStages(jobShortcode: string): Promise<WorkableJobStagesResponse> {
    return this.makeRequest(async () => {
      const response = await axios.get(
        `${this.baseUrl}/jobs/${jobShortcode}/stages`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      this.updateRateLimitInfo(response.headers);
      return response.data;
    });
  }

  // Download using presigned S3 link. This is not subject to the Workable API quota.
  async downloadFile(url: string): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
    });
    return Buffer.from(response.data);
  }
}
