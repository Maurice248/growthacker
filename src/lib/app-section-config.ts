import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Mail,
  Search,
  Trash2,
  BarChart3,
  History,
} from 'lucide-react';

export type AppSection = 'dashboard' | 'outreach';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SectionLabels {
  campaignsTitle: string;
  campaignsDescription: string;
  analyticsTitle: string;
  analyticsDescription: string;
  totalCampaignsTitle: string;
  successRateTitle: string;
  leadsByChartTitle: string;
  scraperDescription: string;
}

export interface SectionConfig {
  basePath: string;
  homeHref: string;
  showLogo: boolean;
  labels: SectionLabels;
  navItems: NavItem[];
}

const dashboardNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Mail },
  { href: '/dashboard/scraper', label: 'Lead Scraper', icon: Search },
  { href: '/dashboard/scraper/history', label: 'Scraper History', icon: History },
  { href: '/dashboard/cleanup', label: 'Cleanup', icon: Trash2 },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
];

const outreachNav: NavItem[] = [
  { href: '/outreach', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/outreach/campaigns', label: 'Email Messages', icon: Mail },
  { href: '/outreach/analytics', label: 'Cold Email Analytics', icon: BarChart3 },
  { href: '/outreach/scraper', label: 'Lead Scraper', icon: Search },
  { href: '/outreach/scraper/history', label: 'Scraper History', icon: History },
  { href: '/outreach/cleanup', label: 'Reset Lead Status', icon: Trash2 },
];

export const SECTION_CONFIG: Record<AppSection, SectionConfig> = {
  dashboard: {
    basePath: '/dashboard',
    homeHref: '/',
    showLogo: false,
    labels: {
      campaignsTitle: 'Campaigns',
      campaignsDescription: 'AI-generated email campaigns with in-dashboard approval',
      analyticsTitle: 'Analytics',
      analyticsDescription: 'Performance metrics for all workflows',
      totalCampaignsTitle: 'Total Campaigns',
      successRateTitle: 'Success Rate',
      leadsByChartTitle: 'Leads by Sheet',
      scraperDescription: 'Scrape Google Maps for business leads via Apify — verified emails only saved to sheet',
    },
    navItems: dashboardNav,
  },
  outreach: {
    basePath: '/outreach',
    homeHref: '/',
    showLogo: true,
    labels: {
      campaignsTitle: 'Email Messages',
      campaignsDescription: 'Manage AI-generated email messages with in-dashboard approval',
      analyticsTitle: 'Cold Email Analytics',
      analyticsDescription: 'Performance metrics for cold email workflows',
      totalCampaignsTitle: 'Total Email Templates Generated',
      successRateTitle: 'Workflows Success Rate',
      leadsByChartTitle: 'Leads by Table',
      scraperDescription: 'Find business leads and save verified contacts to your lead tables',
    },
    navItems: outreachNav,
  },
};
