import axios from 'axios';
import { WorkableJobsResponse } from './types';

export class WorkableAPI {
  private baseUrl: string;
  private apiToken: string;

  constructor(subdomain: string, apiToken: string) {
    this.baseUrl = `https://${subdomain}.workable.com/spi/v3`;
    this.apiToken = apiToken;
  }

  async getJobs(): Promise<WorkableJobsResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/jobs`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Workable API error: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }
}