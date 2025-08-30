import axios from 'axios';
import { WorkableJobsResponse, WorkableCandidatesResponse, WorkableCandidateDetail } from './types';

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

  async getCandidates(jobShortcode: string): Promise<WorkableCandidatesResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/jobs/${jobShortcode}/candidates`, {
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

  async getCandidateById(candidateId: string): Promise<WorkableCandidateDetail> {
    try {
      const response = await axios.get(`${this.baseUrl}/candidates/${candidateId}`, {
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

  async downloadFile(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`File download error: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }
}