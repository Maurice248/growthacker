export type Role = 'APP_ADMIN' | 'ADMIN' | 'COMPANY_MEMBER' | 'COMPANY_ADMIN' | 'VIEWER';
export type WorkflowType = 'CAMPAIGN' | 'SCRAPER' | 'CLEANUP';
export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type ServiceType =
  | 'Hair_Transplant'
  | 'Dental_Treatment'
  | 'Cosmetic_Surgery'
  | 'Eye_Treatment'
  | 'IVF_Fertility'
  | 'Thermal_Wellness'
  | 'All_Services';

export type TargetRegion = 'Europe' | 'Middle East' | 'Asia' | 'North America' | 'Global';

export type CampaignTone =
  | 'Warm and educational'
  | 'Professional and clinical'
  | 'Friendly and encouraging';

export type LeadSheet =
  | 'Tenant Screening Leads'
  | 'Smart Tenant Subscription Leads'
  | 'Rent Promise & Protection Leads'
  | 'Background Screening Leads'
  | 'Property Management Leads'
  | 'All Service Leads';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
}

export interface WorkflowExecution {
  id: string;
  userId: string;
  workflowType: WorkflowType;
  workflowName: string | null;
  status: ExecutionStatus;
  n8nExecutionId: string | null;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  createdAt: Date;
}

export interface Campaign {
  id: string;
  executionId: string;
  campaignName: string;
  serviceType: string;
  targetRegion: string;
  selectedSheet: string;
  totalLeadsSent: number;
  successfulSends: number;
  failedSends: number;
  instantlyCampaignId: string | null;
  createdAt: Date;
  execution: {
    status: ExecutionStatus;
    createdAt: Date;
    duration: number | null;
  };
}

export interface ScraperJob {
  id: string;
  executionId: string;
  niches: string[];
  location: string;
  maxResults: number;
  totalScraped: number;
  validEmails: number;
  invalidEmails: number;
  targetSheet: string;
  apifyRunId: string | null;
  createdAt: Date;
  execution: {
    status: ExecutionStatus;
    createdAt: Date;
    duration: number | null;
  };
}

export interface CleanupLog {
  id: string;
  executionId: string;
  totalContacts: number;
  deletedCount: number;
  triggerType: string;
  cleanupDate: Date;
  execution: {
    status: ExecutionStatus;
    createdAt: Date;
  };
}

export interface AnalyticsData {
  totalCampaigns: number;
  totalLeadsScraped: number;
  totalEmailsSent: number;
  totalCleanups: number;
  successRate: number;
  recentExecutions: WorkflowExecution[];
  campaignsByMonth: { month: string; count: number; sent: number }[];
  leadsBySheet: { sheet: string; count: number }[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}
