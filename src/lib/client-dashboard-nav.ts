import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
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
  Library,
} from 'lucide-react';

export type ClientNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export const CLIENT_HOME_TAB_ID = 'dashboard';

export const CLIENT_BRAND_CONTEXT_TAB_ID = 'profile';

export const CLIENT_CONFIGURATION_TABS: ClientNavItem[] = [
  { id: CLIENT_BRAND_CONTEXT_TAB_ID, label: 'Brand and ICP', icon: User },
  { id: 'analysis', label: 'Competitors', icon: BarChart3 },
];

/** @deprecated Use CLIENT_CONFIGURATION_TABS */
export const CLIENT_TOP_TABS = CLIENT_CONFIGURATION_TABS;

export const CLIENT_META_ADS_TABS: ClientNavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'ads_library', label: 'Ads Library', icon: Library },
  { id: 'create', label: 'Create Ad', icon: WandSparkles },
  { id: 'variants', label: 'Generate Ad Variants', icon: Sparkles },
  { id: 'campaigns', label: 'Campaign Setup', icon: Settings2 },
  { id: 'live_campaigns', label: 'Campaign Monitor', icon: TrendingUp },
  { id: 'ad_performance', label: 'Automated Campaigns', icon: Activity },
  { id: 'reports', label: 'Reports', icon: PieChart },
];

export const CLIENT_SOCIAL_TABS: ClientNavItem[] = [
  { id: 'social-overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'social-creator-studio', label: 'Creator Studio', icon: Sparkles },
];

export const CLIENT_NEWSLETTER_TABS: ClientNavItem[] = [
  { id: 'newsletter-dashboard', label: 'Overview', icon: LayoutDashboard },
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
  { id: 'outreach-dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'outreach-campaigns', label: 'Email Messages', icon: Mail },
  { id: 'outreach-analytics', label: 'Cold Email Analytics', icon: BarChart3 },
  { id: 'outreach-scraper', label: 'Lead Scraper', icon: Search },
  { id: 'outreach-scraper-history', label: 'Scraper History', icon: History },
  { id: 'outreach-cleanup', label: 'Reset Lead Status', icon: Trash2 },
  { id: 'outreach-settings', label: 'Settings', icon: Settings2 },
];

export const CLIENT_OUTREACH_FUTURE_IDS = new Set(CLIENT_OUTREACH_FUTURE_TABS.map((t) => t.id));

export const CLIENT_BLOG_TABS: ClientNavItem[] = [
  { id: 'blog-overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'blog-post', label: 'Blog Posts', icon: FileText },
  { id: 'blog-automation', label: 'Automation', icon: Sparkles },
];

export const CLIENT_META_ADS_IDS = new Set(CLIENT_META_ADS_TABS.map((t) => t.id));
export const CLIENT_SOCIAL_IDS = new Set(CLIENT_SOCIAL_TABS.map((t) => t.id));
export const CLIENT_NEWSLETTER_IDS = new Set(CLIENT_NEWSLETTER_TABS.map((t) => t.id));
export const CLIENT_OUTREACH_IDS = new Set(CLIENT_OUTREACH_TABS.map((t) => t.id));
export const CLIENT_BLOG_IDS = new Set(CLIENT_BLOG_TABS.map((t) => t.id));
export const CLIENT_CONFIGURATION_IDS = new Set(CLIENT_CONFIGURATION_TABS.map((t) => t.id));

export const CLIENT_ALL_TAB_IDS = new Set([
  CLIENT_HOME_TAB_ID,
  ...CLIENT_CONFIGURATION_TABS.map((t) => t.id),
  ...CLIENT_META_ADS_TABS.map((t) => t.id),
  ...CLIENT_SOCIAL_TABS.map((t) => t.id),
  ...CLIENT_OUTREACH_TABS.map((t) => t.id),
  ...CLIENT_OUTREACH_FUTURE_TABS.map((t) => t.id),
  ...CLIENT_NEWSLETTER_TABS.map((t) => t.id),
  ...CLIENT_BLOG_TABS.map((t) => t.id),
]);

export function clientWorkspaceHref(tabId: string) {
  return `/client-dashboard/workspace/${tabId}`;
}

/** Posted from embedded main app iframe when tab changes internally */
export const CLIENT_DASHBOARD_NAVIGATE_EVENT = 'client-dashboard-navigate';

/** Posted from parent shell to embedded main app iframe to switch tabs without reload */
export const CLIENT_DASHBOARD_SET_TAB_EVENT = 'client-dashboard-set-tab';

/** Posted from embedded main app when a long Meta Ads pipeline runs (parent keeps iframe alive) */
export const CLIENT_DASHBOARD_CREATE_AD_GEN_EVENT = 'client-dashboard-create-ad-gen';

export const CREATE_AD_GEN_SESSION_KEY = 'create_ad_gen_active';

/** Persist active variant generation automation id (resume polling after reload) */
export const VARIANT_GEN_AUTOMATION_ID_KEY = 'app_variant_gen_automation_id';

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
  'blog-overview': '/blog/overview',
  'blog-post': '/blog',
  'blog-automation': '/blog/automation',
};

const EMBED_SECTION_PATHS: Record<string, string> = {
  ...OUTREACH_PATHS,
  ...NEWSLETTER_PATHS,
  ...BLOG_PATHS,
};

const EMBED_PATH_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(EMBED_SECTION_PATHS).map(([tabId, path]) => [path, tabId])
);

export function clientTabIdFromEmbedPath(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return EMBED_PATH_TO_TAB[normalized] ?? null;
}

/** Tell the parent shell to switch sidebar tab when navigating inside an embed iframe. */
export function notifyParentEmbedNavigate(pathname: string): boolean {
  if (typeof window === 'undefined' || window.parent === window) return false;
  const tabId = clientTabIdFromEmbedPath(pathname);
  if (!tabId) return false;
  window.parent.postMessage(
    { type: CLIENT_DASHBOARD_NAVIGATE_EVENT, tabId },
    window.location.origin
  );
  return true;
}

const MAIN_APP_TABS = new Set([
  'profile',
  'analysis',
  'overview',
  'ads_library',
  'create',
  'variants',
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

/** Background Create Ad / variants / Creator Studio jobs keep running in the iframe — no leave prompt. */
export function confirmLeaveDuringCreateAdGen(_targetHref: string): boolean {
  return true;
}

export function clientTabEmbedSrc(tabId: string): string | null {
  if (OUTREACH_PATHS[tabId]) return `${OUTREACH_PATHS[tabId]}?embed=1`;
  if (NEWSLETTER_PATHS[tabId]) return `${NEWSLETTER_PATHS[tabId]}?embed=1`;
  if (BLOG_PATHS[tabId]) return `${BLOG_PATHS[tabId]}?embed=1`;
  if (MAIN_APP_TABS.has(tabId)) return `/?tab=${tabId}&embed=1`;
  return null;
}

/** First workspace tab to open when entering a module from the home dashboard. */
export const CLIENT_MODULE_ENTRY_TABS: Record<string, string> = {
  meta: CLIENT_META_ADS_TABS[0].id,
  social: CLIENT_SOCIAL_TABS[0].id,
  outreach: CLIENT_OUTREACH_TABS[0].id,
  newsletter: CLIENT_NEWSLETTER_TABS[0].id,
  blog: CLIENT_BLOG_TABS[0].id,
};

export function clientTabLabel(tabId: string): string {
  if (tabId === CLIENT_HOME_TAB_ID) return 'Dashboard';
  const all = [
    ...CLIENT_CONFIGURATION_TABS,
    ...CLIENT_META_ADS_TABS,
    ...CLIENT_SOCIAL_TABS,
    ...CLIENT_OUTREACH_TABS,
    ...CLIENT_OUTREACH_FUTURE_TABS,
    ...CLIENT_NEWSLETTER_TABS,
    ...CLIENT_BLOG_TABS,
  ];
  return all.find((t) => t.id === tabId)?.label ?? tabId;
}
