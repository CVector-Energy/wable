import * as fs from 'fs';
import * as path from 'path';
import { CandidateManager } from '../candidate-manager';
import { WorkableAPI } from '../workable-api';

jest.mock('fs');
jest.mock('../workable-api');

const mockedFs = fs as jest.Mocked<typeof fs>;
const MockedWorkableAPI = WorkableAPI as jest.MockedClass<typeof WorkableAPI>;

describe('CandidateManager', () => {
  let candidateManager: CandidateManager;
  let mockWorkableAPI: jest.Mocked<WorkableAPI>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    
    mockWorkableAPI = {
      getCandidates: jest.fn(),
      getCandidateById: jest.fn(),
      downloadFile: jest.fn(),
    } as any;

    candidateManager = new CandidateManager(mockWorkableAPI);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('downloadCandidates', () => {
    const mockCandidate = {
      id: 'candidate123',
      email: 'john.doe@example.com',
      name: 'John Doe',
      updated_at: '2023-12-01T10:00:00Z',
      firstname: 'John',
      lastname: 'Doe',
      headline: 'Software Engineer',
      account: { subdomain: 'test', name: 'Test Company' },
      job: { shortcode: 'SE001', title: 'Software Engineer' },
      stage: 'sourced',
      disqualified: false,
      disqualification_reason: null,
      hired_at: null,
      sourced: true,
      profile_url: 'https://test.workable.com/candidate/123',
      address: '123 Main St',
      phone: '555-1234',
      domain: 'example.com',
      created_at: '2023-11-01T10:00:00Z',
      resume_url: 'https://example.com/resume.pdf',
      cover_letter: 'I am interested in this position...'
    };

    const mockCandidateDetail = {
      ...mockCandidate,
      image_url: null,
      summary: 'Experienced software engineer',
      experience_entries: [],
      education_entries: [],
      skills: ['JavaScript', 'TypeScript'],
      tags: [],
      social_profiles: [],
      attachments: [],
      answers: [],
      location: {
        country: 'United States',
        country_code: 'US',
        region: 'California',
        region_code: 'CA',
        city: 'San Francisco',
        zip_code: '94102',
        telecommuting: false
      },
      stage_kind: 'sourced',
      withdrew: false
    };

    beforeEach(() => {
      mockWorkableAPI.getCandidates.mockResolvedValue({
        candidates: [mockCandidate],
        paging: { next: null }
      });
      
      mockWorkableAPI.getCandidateById.mockResolvedValue(mockCandidateDetail);
      mockWorkableAPI.downloadFile.mockResolvedValue(Buffer.from('PDF content'));
      
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation();
      mockedFs.writeFileSync.mockImplementation();
    });

    it('should download new candidates', async () => {
      await candidateManager.downloadCandidates('SE001');

      expect(mockWorkableAPI.getCandidates).toHaveBeenCalledWith('SE001');
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'john.doe@example.com'),
        { recursive: true }
      );
      expect(mockWorkableAPI.getCandidateById).toHaveBeenCalledWith('candidate123');
      expect(mockWorkableAPI.downloadFile).toHaveBeenCalledWith('https://example.com/resume.pdf');
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'john.doe@example.com', 'workable-index.json'),
        JSON.stringify(mockCandidate, null, 2)
      );
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'john.doe@example.com', 'workable-show.json'),
        JSON.stringify(mockCandidateDetail, null, 2)
      );
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'john.doe@example.com', '0-RESUME.pdf'),
        Buffer.from('PDF content')
      );
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'john.doe@example.com', '0-COVER.txt'),
        'I am interested in this position...'
      );
    });

    it('should skip candidates that are up to date', async () => {
      const existingData = { updated_at: '2023-12-01T12:00:00Z' };
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(existingData));

      await candidateManager.downloadCandidates('SE001');

      expect(mockWorkableAPI.getCandidateById).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Skipping candidate (up to date): john.doe@example.com');
    });

    it('should handle candidates without resume or cover letter', async () => {
      const candidateWithoutFiles = {
        ...mockCandidate,
        resume_url: null,
        cover_letter: null
      };

      const candidateDetailWithoutFiles = {
        ...mockCandidateDetail,
        resume_url: null,
        cover_letter: null
      };

      mockWorkableAPI.getCandidates.mockResolvedValue({
        candidates: [candidateWithoutFiles],
        paging: { next: null }
      });
      
      mockWorkableAPI.getCandidateById.mockResolvedValue(candidateDetailWithoutFiles);

      await candidateManager.downloadCandidates('SE001');

      expect(mockWorkableAPI.downloadFile).not.toHaveBeenCalled();
      expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(3); // Index, show files, and profile
    });
  });
});