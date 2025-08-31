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

export interface WorkableEducationEntry {
  degree: string;
  school: string;
  field_of_study: string;
  start_date: string | null;
  end_date: string | null;
}

export interface WorkableExperienceEntry {
  title: string;
  company: string;
  industry: string;
  summary: string;
  start_date: string | null;
  end_date: string | null;
  current: boolean;
}

export interface WorkableSocialProfile {
  type: string;
  name: string;
  username: string;
  url: string;
}

export interface WorkableLocation {
  country: string;
  country_code: string;
  region: string;
  region_code: string;
  city: string;
  zip_code: string;
  telecommuting: boolean;
}

export interface WorkableCandidateDetail extends WorkableCandidate {
  image_url: string | null;
  summary: string;
  experience_entries: WorkableExperienceEntry[];
  education_entries: WorkableEducationEntry[];
  skills: string[];
  tags: string[];
  social_profiles: WorkableSocialProfile[];
  attachments: any[];
  answers: any[];
  location: WorkableLocation;
  stage_kind: string;
  withdrew: boolean;
}