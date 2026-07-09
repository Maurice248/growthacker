import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  FileText,
  History,
  LayoutDashboard,
  Mail,
  Megaphone,
  Newspaper,
  PenLine,
  PieChart,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  WandSparkles,
  MessageSquare,
  Phone,
  Smartphone,
} from 'lucide-react';

export type ClientNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export const CLIENT_BRAND_CONTEXT_TAB_ID = 'profile';

export const CLIENT_TOP_TABS: ClientNavItem[] = [
  { id: CLIENT_BRAND_CONTEXT_TAB_ID, label: 'Brand Context', icon: User },
  { id: 'analysis', label: 'Ads Lab', icon: BarChart3 },
];

export const CLIENT_META_ADS_TABS: ClientNavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'create', label: 'Create Ad', icon: WandSparkles },
  { id: 'approval', label: 'Approval', icon: ClipboardCheck },
  { id: 'campaigns', label: 'Campaign Setup', icon: Settings2 },
  { id: 'live_campaigns', label: 'Running Campaign', icon: TrendingUp },
  { id: 'ad_performance', label: 'Ad Performance', icon: Activity },
  { id: 'reports', label: 'Reports', icon: PieChart },
];

export const CLIENT_SOCIAL_TABS: ClientNavItem[] = [
  { id: 'social-overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'social-creator-studio', label: 'Creator Studio', icon: Sparkles },
];

export const CLIENT_NEWSLETTER_TABS: ClientNavItem[] = [
  { id: 'newsletter-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'newsletter-overview', label: 'Settings', icon: Settings2 },
  { id: 'newsletter-generate', label: 'Generate Newsletter', icon: PenLine },
  { id: 'newsletter-campaign', label: 'Create Campaign', icon: Megaphone },
  { id: 'newsletter-subscribers', label: 'Subscribers', icon: User },
  { id: 'newsletter-history', label: 'History', icon: History },
  { id: 'newsletter-services', label: 'Manage Services', icon: Settings2 },
];

export const CLIENT_OUTREACH_FUTURE_TABS: ClientNavItem[] = [
  { id: 'cold-dm', label: 'Cold DM', icon: MessageSquare },
  { id: 'cold-call', label: 'Cold Call', icon: Phone },
  { id: 'cold-sms', label: 'Cold SMS', icon: Smartphone },
];

export const CLIENT_OUTREACH_TABS: ClientNavItem[] = [
  { id: 'outreach-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'outreach-campaigns', label: 'Email Messages', icon: Mail },
  { id: 'outreach-analytics', label: 'Cold Email Analytics', icon: BarChart3 },
  { id: 'outreach-scraper', label: 'Lead Scraper', icon: Search },
  { id: 'outreach-scraper-history', label: 'Scraper History', icon: History },
  { id: 'outreach-cleanup', label: 'Reset Lead Status', icon: Trash2 },
  { id: 'outreach-settings', label: 'Settings', icon: Settings2 },
];

export const CLIENT_OUTREACH_FUTURE_IDS = new Set(CLIENT_OUTREACH_FUTURE_TABS.map((t) => t.id));

export const CLIENT_BLOG_TABS: ClientNavItem[] = [
  { id: 'blog-post', label: 'Blog Posts', icon: FileText },
  { id: 'blog-automation', label: 'Automation', icon: Sparkles },
];

export const CLIENT_META_ADS_IDS = new Set(CLIENT_META_ADS_TABS.map((t) => t.id));
export const CLIENT_SOCIAL_IDS = new Set(CLIENT_SOCIAL_TABS.map((t) => t.id));
export const CLIENT_NEWSLETTER_IDS = new Set(CLIENT_NEWSLETTER_TABS.map((t) => t.id));
export const CLIENT_OUTREACH_IDS = new Set(CLIENT_OUTREACH_TABS.map((t) => t.id));
export const CLIENT_BLOG_IDS = new Set(CLIENT_BLOG_TABS.map((t) => t.id));

export const CLIENT_ALL_TAB_IDS = new Set([
  ...CLIENT_TOP_TABS.map((t) => t.id),
  ...CLIENT_META_ADS_TABS.map((t) => t.id),
  ...CLIENT_SOCIAL_TABS.map((t) => t.id),
  ...CLIENT_NEWSLETTER_TABS.map((t) => t.id),
  ...CLIENT_OUTREACH_TABS.map((t) => t.id),
  ...CLIENT_OUTREACH_FUTURE_TABS.map((t) => t.id),
  ...CLIENT_BLOG_TABS.map((t) => t.id),
]);

export function clientWorkspaceHref(tabId: string) {
  return `/client-dashboard/workspace/${tabId}`;
}

/** Posted from embedded main app iframe when tab changes internally */
export const CLIENT_DASHBOARD_NAVIGATE_EVENT = 'client-dashboard-navigate';

/** Posted from parent shell to embedded main app iframe to switch tabs without reload */
export const CLIENT_DASHBOARD_SET_TAB_EVENT = 'client-dashboard-set-tab';

export function isClientDashboardTabId(tabId: string) {
  return CLIENT_ALL_TAB_IDS.has(tabId);
}

const OUTREACH_PATHS: Record<string, string> = {
  'outreach-dashboard': '/outreach',
  'outreach-campaigns': '/outreach/campaigns',
  'outreach-analytics': '/outreach/analytics',
  'outreach-scraper': '/outreach/scraper',
  'outreach-scraper-history': '/outreach/scraper/history',
  'outreach-cleanup': '/outreach/cleanup',
  'outreach-settings': '/outreach/settings',
};

const NEWSLETTER_PATHS: Record<string, string> = {
  'newsletter-dashboard': '/newsletter/dashboard',
  'newsletter-overview': '/newsletter/overview',
  'newsletter-generate': '/newsletter/generate',
  'newsletter-campaign': '/newsletter/campaign',
  'newsletter-subscribers': '/newsletter/subscribers',
  'newsletter-history': '/newsletter/history',
  'newsletter-services': '/newsletter/services',
};

const BLOG_PATHS: Record<string, string> = {
  'blog-post': '/blog',
  'blog-automation': '/blog/automation',
};

const MAIN_APP_TABS = new Set([
  'profile',
  'analysis',
  'overview',
  'create',
  'approval',
  'campaigns',
  'live_campaigns',
  'ad_performance',
  'reports',
  'social-overview',
  'social-creator-studio',
  'social-dash',
  'cold-dm',
  'cold-call',
  'cold-sms',
]);

export function isMainAppEmbedTab(tabId: string) {
  return MAIN_APP_TABS.has(tabId);
}

export function clientTabEmbedSrc(tabId: string): string | null {
  if (OUTREACH_PATHS[tabId]) return `${OUTREACH_PATHS[tabId]}?embed=1`;
  if (NEWSLETTER_PATHS[tabId]) return `${NEWSLETTER_PATHS[tabId]}?embed=1`;
  if (BLOG_PATHS[tabId]) return `${BLOG_PATHS[tabId]}?embed=1`;
  if (MAIN_APP_TABS.has(tabId)) return `/?tab=${tabId}&embed=1`;
  return null;
}

export function clientTabLabel(tabId: string): string {
  const all = [
    ...CLIENT_TOP_TABS,
    ...CLIENT_META_ADS_TABS,
    ...CLIENT_SOCIAL_TABS,
    ...CLIENT_NEWSLETTER_TABS,
    ...CLIENT_OUTREACH_TABS,
    ...CLIENT_OUTREACH_FUTURE_TABS,
    ...CLIENT_BLOG_TABS,
  ];
  return all.find((t) => t.id === tabId)?.label ?? tabId;
}
