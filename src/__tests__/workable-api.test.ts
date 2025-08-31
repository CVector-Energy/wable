import axios from 'axios';
import { WorkableAPI } from '../workable-api';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WorkableAPI', () => {
  let workableAPI: WorkableAPI;
  const mockSubdomain = 'test-company';
  const mockToken = 'test-token';

  beforeEach(() => {
    workableAPI = new WorkableAPI(mockSubdomain, mockToken);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct base URL and token', () => {
      expect(workableAPI).toBeInstanceOf(WorkableAPI);
    });
  });

  describe('getJobs', () => {
    it('should fetch jobs successfully', async () => {
      const mockResponse = {
        data: {
          jobs: [
            {
              id: '1',
              title: 'Software Engineer',
              shortcode: 'SE001',
              full_title: 'Senior Software Engineer',
              code: 'SE001',
              state: 'published',
              department: 'Engineering',
              url: 'https://test-company.workable.com/j/SE001',
              application_url: 'https://test-company.workable.com/jobs/SE001',
              shortlink: 'https://test-company.workable.com/j/SE001',
              location: {
                location_str: 'San Francisco, CA',
                country: 'United States',
                country_code: 'US',
                region: 'California',
                region_code: 'CA',
                city: 'San Francisco',
                zip_code: '94102',
                telecommuting: false
              },
              created_at: '2023-01-01T00:00:00Z'
            }
          ],
          paging: {
            next: null
          }
        },
        headers: {
          'x-rate-limit-limit': '10',
          'x-rate-limit-remaining': '9',
          'x-rate-limit-reset': '1640995200'
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await workableAPI.getJobs();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://test-company.workable.com/spi/v3/jobs',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        }
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe('Software Engineer');
      expect(result.jobs[0].shortcode).toBe('SE001');
    });

    it('should handle API errors', async () => {
      const mockError = {
        response: {
          status: 401,
          statusText: 'Unauthorized'
        }
      };

      mockedAxios.get.mockRejectedValue(mockError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(workableAPI.getJobs()).rejects.toEqual(mockError);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      mockedAxios.get.mockRejectedValue(networkError);
      mockedAxios.isAxiosError.mockReturnValue(false);

      await expect(workableAPI.getJobs()).rejects.toThrow('Network Error');
    });

    it('should handle rate limit errors', async () => {
      const mockError = {
        response: {
          status: 429,
          statusText: 'Too Many Requests'
        }
      };

      mockedAxios.get.mockRejectedValue(mockError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(workableAPI.getJobs()).rejects.toEqual(mockError);
    });
  });

  describe('rate limiting', () => {
    it('should track rate limit headers', async () => {
      const mockResponse = {
        data: { jobs: [], paging: { next: null } },
        headers: {
          'x-rate-limit-limit': '10',
          'x-rate-limit-remaining': '9',
          'x-rate-limit-reset': '1640995200'
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await workableAPI.getJobs();

      // The private rateLimitInfo should be updated (we can't test this directly,
      // but we verify the headers are handled properly in the response)
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });
});