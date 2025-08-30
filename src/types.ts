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