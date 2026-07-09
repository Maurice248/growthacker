import { z } from 'zod';

export const LEAD_SHEET_OPTIONS = [
  'Default List',
] as const;

export const campaignSchema = z.object({
  campaign_name: z.string().min(1, 'Campaign name is required'),
  service_type: z.enum([
    'Tenant_Reports',
    'Smart_Tenant_Subscription',
    'Rent_Protection',
    'Background_Screening',
    'Property_Management',
    'All_Services',
  ]),
  target_region: z.enum(['Canada', 'North America', 'Global']),
  campaign_goal: z.string().min(1, 'Campaign goal is required'),
  campaign_message: z.string().min(10, 'Message must be at least 10 characters'),
  cta_button_text: z.string().min(1, 'CTA button text is required'),
  cta_link: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tone: z.enum([
    'Warm and educational',
    'Professional and clinical',
    'Friendly and encouraging',
    'Professional and authoritative',
    'Friendly and conversational',
    'Urgent and action-oriented',
  ]),
  selected_sheet: z.string().min(1, 'Lead list is required'),
});

export const scraperSchema = z.object({
  niches: z.string().min(1, 'At least one niche is required'),
  location: z.string().min(1, 'Location is required'),
  max_results: z.number().min(1).max(1000),
  target_sheet: z.string().min(1, 'Lead list is required'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type CampaignFormValues = z.infer<typeof campaignSchema>;
export type ScraperFormValues = z.infer<typeof scraperSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
