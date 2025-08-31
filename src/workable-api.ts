import axios, { RawAxiosResponseHeaders, AxiosResponseHeaders } from 'axios';
import { WorkableJobsResponse, WorkableCandidatesResponse, WorkableCandidateDetail } from './types';

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

  private updateRateLimitInfo(headers: RawAxiosResponseHeaders | AxiosResponseHeaders): void {
    this.rateLimitInfo = {
      limit: parseInt(headers['x-rate-limit-limit'] || '10', 10),
      remaining: parseInt(headers['x-rate-limit-remaining'] || '10', 10),
      resetTime: parseInt(headers['x-rate-limit-reset'] || '0', 10)
    };
  }

  private async waitForRateLimit(): Promise<void> {
    if (!this.rateLimitInfo) return;

    if (this.rateLimitInfo.remaining <= 1) {
      const now = Date.now() / 1000;
      const waitTime = Math.max(0, this.rateLimitInfo.resetTime - now) * 1000;
      
      if (waitTime > 0) {
        console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime + 1000)); // Add 1s buffer
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
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  async getJobs(): Promise<WorkableJobsResponse> {
    return this.makeRequest(async () => {
      try {
        const response = await axios.get(`${this.baseUrl}/jobs`, {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        });
        this.updateRateLimitInfo(response.headers);
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 429) {
            throw new Error('Rate limit exceeded. Please wait before making more requests.');
          }
          throw new Error(`Workable API error: ${error.response?.status} ${error.response?.statusText}`);
        }
        throw error;
      }
    });
  }

  async getCandidates(jobShortcode: string): Promise<WorkableCandidatesResponse> {
    return this.makeRequest(async () => {
      try {
        const response = await axios.get(`${this.baseUrl}/jobs/${jobShortcode}/candidates`, {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        });
        this.updateRateLimitInfo(response.headers);
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 429) {
            throw new Error('Rate limit exceeded. Please wait before making more requests.');
          }
          throw new Error(`Workable API error: ${error.response?.status} ${error.response?.statusText}`);
        }
        throw error;
      }
    });
  }

  async getCandidateById(candidateId: string): Promise<WorkableCandidateDetail> {
    return this.makeRequest(async () => {
      try {
        const response = await axios.get(`${this.baseUrl}/candidates/${candidateId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        });
        this.updateRateLimitInfo(response.headers);
        return response.data.candidate;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 429) {
            throw new Error('Rate limit exceeded. Please wait before making more requests.');
          }
          throw new Error(`Workable API error: ${error.response?.status} ${error.response?.statusText}`);
        }
        throw error;
      }
    });
  }

  // Download using presigned S3 link. This is not subject to the Workable API quota.
  async downloadFile(url: string): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  }
}
