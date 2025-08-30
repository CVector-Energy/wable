export interface WorkableJob {
  id: string;
  title: string;
  full_title: string;
  shortcode: string;
  code: string;
  state: string;
  department: string;
  url: string;
  application_url: string;
  shortlink: string;
  location: {
    location_str: string;
    country: string;
    country_code: string;
    region: string;
    region_code: string;
    city: string;
    zip_code: string;
    telecommuting: boolean;
  };
  created_at: string;
}

export interface WorkableJobsResponse {
  jobs: WorkableJob[];
  paging: {
    next: string | null;
  };
}

export interface WorkableCandidate {
  id: string;
  name: string;
  firstname: string;
  lastname: string;
  headline: string;
  account: {
    subdomain: string;
    name: string;
  };
  job: {
    shortcode: string;
    title: string;
  };
  stage: string;
  disqualified: boolean;
  disqualification_reason: string | null;
  hired_at: string | null;
  sourced: boolean;
  profile_url: string;
  address: string;
  phone: string;
  email: string;
  domain: string;
  created_at: string;
  updated_at: string;
  resume_url: string | null;
  cover_letter: string | null;
}

export interface WorkableCandidatesResponse {
  candidates: WorkableCandidate[];
  paging: {
    next: string | null;
  };
}

export interface WorkableCandidateDetail extends WorkableCandidate {
  summary: string;
  experience: any[];
  education: any[];
  skills: string[];
  tags: string[];
  social_profiles: any[];
  attachments: any[];
}