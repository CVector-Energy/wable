import * as fs from 'fs';
import * as path from 'path';
import { CandidateManager } from '../candidate-manager';
import { WorkableAPI } from '../workable-api';

jest.mock('../workable-api');

const MockedWorkableAPI = WorkableAPI as jest.MockedClass<typeof WorkableAPI>;

describe('CandidateManager', () => {
  let candidateManager: CandidateManager;
  let mockWorkableAPI: jest.Mocked<WorkableAPI>;
  let testDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Create unique test directory with test name for better clarity
    const timestamp = Date.now();
    const testName = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';
    testDir = path.join(process.cwd(), 'var', 'jest', testName, timestamp.toString());
    fs.mkdirSync(testDir, { recursive: true });
    
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
      experience_entries: [
        {
          title: 'Senior Developer',
          company: 'Tech Corp',
          industry: 'Technology',
          summary: 'Led development team',
          start_date: '2022-01-01',
          end_date: null,
          current: true
        },
        {
          title: 'Java Developer', 
          company: 'Partners Soft',
          industry: null,
          summary: 'Worked on enterprise applications',
          start_date: '2024-10-01',
          end_date: '2025-03-01',
          current: false
        }
      ],
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
    });

    it('should download new candidates', async () => {
      await candidateManager.downloadCandidates('SE001', testDir);

      expect(mockWorkableAPI.getCandidates).toHaveBeenCalledWith('SE001');
      expect(mockWorkableAPI.getCandidateById).toHaveBeenCalledWith('candidate123');
      expect(mockWorkableAPI.downloadFile).toHaveBeenCalledWith('https://example.com/resume.pdf');

      // Verify files were created
      const candidateDir = path.join(testDir, 'john.doe@example.com');
      expect(fs.existsSync(candidateDir)).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, 'workable-index.json'))).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, 'workable-show.json'))).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, '0-PROFILE.md'))).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, '0-RESUME.pdf'))).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, '0-COVER.txt'))).toBe(true);

      // Verify file contents
      const indexContent = JSON.parse(fs.readFileSync(path.join(candidateDir, 'workable-index.json'), 'utf-8'));
      expect(indexContent.email).toBe('john.doe@example.com');

      const showContent = JSON.parse(fs.readFileSync(path.join(candidateDir, 'workable-show.json'), 'utf-8'));
      expect(showContent.skills).toEqual(['JavaScript', 'TypeScript']);

      const profileContent = fs.readFileSync(path.join(candidateDir, '0-PROFILE.md'), 'utf-8');
      expect(profileContent).toContain('# John Doe');
      expect(profileContent).toContain('📧 john.doe@example.com');
      
      // Verify experience entries are formatted correctly
      expect(profileContent).toContain('### Senior Developer at Tech Corp\n**Dec 2021 - Present** | Technology');
      expect(profileContent).toContain('### Java Developer at Partners Soft\n**Sep 2024 - Feb 2025**\n'); // No industry shown
      expect(profileContent).not.toContain('| null'); // Should never show "| null"

      const resumeContent = fs.readFileSync(path.join(candidateDir, '0-RESUME.pdf'));
      expect(resumeContent).toEqual(Buffer.from('PDF content'));

      const coverContent = fs.readFileSync(path.join(candidateDir, '0-COVER.txt'), 'utf-8');
      expect(coverContent).toBe('I am interested in this position...');
    });

    it('should skip candidates that are up to date', async () => {
      // Pre-create candidate directory with existing data that's newer
      const candidateDir = path.join(testDir, 'john.doe@example.com');
      fs.mkdirSync(candidateDir, { recursive: true });
      
      const existingData = { ...mockCandidate, updated_at: '2023-12-01T12:00:00Z' };
      fs.writeFileSync(path.join(candidateDir, 'workable-index.json'), JSON.stringify(existingData, null, 2));

      await candidateManager.downloadCandidates('SE001', testDir);

      expect(mockWorkableAPI.getCandidates).toHaveBeenCalledWith('SE001');
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

      await candidateManager.downloadCandidates('SE001', testDir);

      expect(mockWorkableAPI.downloadFile).not.toHaveBeenCalled();

      // Verify only the files that should exist are created
      const candidateDir = path.join(testDir, 'john.doe@example.com');
      expect(fs.existsSync(path.join(candidateDir, 'workable-index.json'))).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, 'workable-show.json'))).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, '0-PROFILE.md'))).toBe(true);
      expect(fs.existsSync(path.join(candidateDir, '0-RESUME.pdf'))).toBe(false);
      expect(fs.existsSync(path.join(candidateDir, '0-COVER.txt'))).toBe(false);
    });
  });
});