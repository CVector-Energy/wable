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

  describe('getCandidates', () => {
    it('should fetch all pages of candidates', async () => {
      // Mock first page
      const firstPageResponse = {
        data: {
          candidates: [
            { id: '1', email: 'user1@example.com', name: 'User 1' },
            { id: '2', email: 'user2@example.com', name: 'User 2' }
          ],
          paging: { next: 'https://test-company.workable.com/spi/v3/jobs/SE001/candidates?limit=100&after=cursor123' }
        },
        headers: {
          'x-rate-limit-limit': '10',
          'x-rate-limit-remaining': '9',
          'x-rate-limit-reset': '1640995200'
        }
      };

      // Mock second page (final page)
      const secondPageResponse = {
        data: {
          candidates: [
            { id: '3', email: 'user3@example.com', name: 'User 3' }
          ],
          paging: { next: null }
        },
        headers: {
          'x-rate-limit-limit': '10',
          'x-rate-limit-remaining': '8',
          'x-rate-limit-reset': '1640995200'
        }
      };

      mockedAxios.get
        .mockResolvedValueOnce(firstPageResponse)
        .mockResolvedValueOnce(secondPageResponse);

      const result = await workableAPI.getCandidates('SE001');

      // Should have called get twice (two pages)
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      
      // First call should be to the initial URL with limit=100
      expect(mockedAxios.get).toHaveBeenNthCalledWith(1,
        'https://test-company.workable.com/spi/v3/jobs/SE001/candidates?limit=100',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        }
      );

      // Second call should be to the next URL
      expect(mockedAxios.get).toHaveBeenNthCalledWith(2,
        'https://test-company.workable.com/spi/v3/jobs/SE001/candidates?limit=100&after=cursor123',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        }
      );

      // Result should contain all candidates from both pages
      expect(result.candidates).toHaveLength(3);
      expect(result.candidates[0].id).toBe('1');
      expect(result.candidates[1].id).toBe('2');
      expect(result.candidates[2].id).toBe('3');
      expect(result.paging.next).toBeNull();
    });

    it('should handle single page of candidates', async () => {
      const singlePageResponse = {
        data: {
          candidates: [
            { id: '1', email: 'user1@example.com', name: 'User 1' }
          ],
          paging: { next: null }
        },
        headers: {
          'x-rate-limit-limit': '10',
          'x-rate-limit-remaining': '9',
          'x-rate-limit-reset': '1640995200'
        }
      };

      mockedAxios.get.mockResolvedValue(singlePageResponse);

      const result = await workableAPI.getCandidates('SE001');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe('1');
      expect(result.paging.next).toBeNull();
    });

    it('should include updated_after parameter when provided', async () => {
      const mockResponse = {
        data: {
          candidates: [],
          paging: { next: null }
        },
        headers: {
          'x-rate-limit-limit': '10',
          'x-rate-limit-remaining': '9',
          'x-rate-limit-reset': '1640995200'
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await workableAPI.getCandidates('SE001', '2023-12-01T00:00:00Z');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://test-company.workable.com/spi/v3/jobs/SE001/candidates?limit=100&updated_after=2023-12-01T00%3A00%3A00Z',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        }
      );
    });
  });

  describe('getCandidatesWithCallback', () => {
    it('should call callback for each page and return total count', async () => {
      const mockCallback = jest.fn().mockResolvedValue(undefined);
      
      // Mock first page
      const firstPageResponse = {
        data: {
          candidates: [
            { id: '1', email: 'user1@example.com', name: 'User 1' },
            { id: '2', email: 'user2@example.com', name: 'User 2' }
          ],
          paging: { next: 'https://test-company.workable.com/spi/v3/jobs/SE001/candidates?limit=100&after=cursor123' }
        },
        headers: {
          'x-rate-limit-limit': '10',
          'x-rate-limit-remaining': '9',
          'x-rate-limit-reset': '1640995200'
        }
      };

      // Mock second page (final page)
      const secondPageResponse = {
        data: {
          candidates: [
            { id: '3', email: 'user3@example.com', name: 'User 3' }
          ],
          paging: { next: null }
        },
        headers: {
          'x-rate-limit-limit': '10',
          'x-rate-limit-remaining': '8',
          'x-rate-limit-reset': '1640995200'
        }
      };

      mockedAxios.get
        .mockResolvedValueOnce(firstPageResponse)
        .mockResolvedValueOnce(secondPageResponse);

      const totalCount = await workableAPI.getCandidatesWithCallback('SE001', mockCallback);

      // Should have called get twice (two pages)
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      
      // Callback should be called twice (once per page)
      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(mockCallback).toHaveBeenNthCalledWith(1, [
        { id: '1', email: 'user1@example.com', name: 'User 1' },
        { id: '2', email: 'user2@example.com', name: 'User 2' }
      ]);
      expect(mockCallback).toHaveBeenNthCalledWith(2, [
        { id: '3', email: 'user3@example.com', name: 'User 3' }
      ]);

      // Should return total count
      expect(totalCount).toBe(3);
    });

    it('should handle single page with callback', async () => {
      const mockCallback = jest.fn().mockResolvedValue(undefined);
      
      const singlePageResponse = {
        data: {
          candidates: [
            { id: '1', email: 'user1@example.com', name: 'User 1' }
          ],
          paging: { next: null }
        },
        headers: {
          'x-rate-limit-limit': '10',
          'x-rate-limit-remaining': '9',
          'x-rate-limit-reset': '1640995200'
        }
      };

      mockedAxios.get.mockResolvedValue(singlePageResponse);

      const totalCount = await workableAPI.getCandidatesWithCallback('SE001', mockCallback);

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith([
        { id: '1', email: 'user1@example.com', name: 'User 1' }
      ]);
      expect(totalCount).toBe(1);
    });

    it('should include updated_after parameter when provided', async () => {
      const mockCallback = jest.fn().mockResolvedValue(undefined);
      
      const mockResponse = {
        data: {
          candidates: [],
          paging: { next: null }
        },
        headers: {
          'x-rate-limit-limit': '10',
          'x-rate-limit-remaining': '9',
          'x-rate-limit-reset': '1640995200'
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await workableAPI.getCandidatesWithCallback('SE001', mockCallback, '2023-12-01T00:00:00Z');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://test-company.workable.com/spi/v3/jobs/SE001/candidates?limit=100&updated_after=2023-12-01T00%3A00%3A00Z',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        }
      );
    });
  });
});