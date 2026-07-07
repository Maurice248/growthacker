'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Megaphone, Newspaper, Send, FileText, Settings, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CLIENT_BLOG_TABS,
  CLIENT_BRAND_CONTEXT_TAB_ID,
  CLIENT_META_ADS_TABS,
  CLIENT_NEWSLETTER_TABS,
  CLIENT_OUTREACH_TABS,
  CLIENT_SOCIAL_TABS,
  CLIENT_TOP_TABS,
  clientWorkspaceHref,
} from '@/lib/client-dashboard-nav';
import {
  moduleForTab,
  type ModuleId,
  type ModuleStatus,
} from '@/lib/company-module-status';

type ClientDashboardNavProps = {
  collapsed: boolean;
  integrationsConfigured: boolean;
  moduleStatuses: ModuleStatus[];
  onNavigate?: () => void;
};

function tabFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/client-dashboard\/workspace\/([^/]+)$/);
  return match?.[1] ?? null;
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  indent,
  disabled,
  disabledTitle,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  collapsed: boolean;
  indent?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  onNavigate?: () => void;
}) {
  const className = cn(
    'relative flex items-center rounded-[var(--radius-md)] text-[13px] font-medium transition-colors',
    collapsed ? 'justify-center px-0 py-2.5' : indent ? 'gap-2.5 px-3 py-2 pl-7' : 'gap-2.5 px-3 py-2',
    disabled
      ? 'cursor-not-allowed opacity-40'
      : active
        ? 'bg-[var(--primary-light)] font-bold text-[var(--primary-dark)] shadow-[0_1px_3px_rgba(37,99,235,0.12)]'
        : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
  );

  if (disabled) {
    return (
      <span title={disabledTitle} className={className}>
        {active && !collapsed && (
          <span className="absolute left-0 top-[20%] h-[60%] w-[3px] rounded-r bg-[var(--primary)]" />
        )}
        <Icon size={15} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </span>
    );
  }

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={className}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-[20%] h-[60%] w-[3px] rounded-r bg-[var(--primary)]" />
      )}
      <Icon size={15} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function NavGroup({
  label,
  icon: Icon,
  open,
  onToggle,
  active,
  collapsed,
  disabled,
  disabledTitle,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  collapsed: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        title={disabled ? disabledTitle : collapsed ? label : undefined}
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={cn(
          'relative flex w-full items-center rounded-[var(--radius-md)] border-none text-left text-[13px] font-medium transition-colors',
          collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
          disabled
            ? 'cursor-not-allowed opacity-40'
            : active
              ? 'bg-[var(--primary-light)] font-bold text-[var(--primary-dark)]'
              : open
                ? 'bg-[var(--surface)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
        )}
      >
        {active && !collapsed && (
          <span className="absolute left-0 top-[20%] h-[60%] w-[3px] rounded-r bg-[var(--primary)]" />
        )}
        <Icon size={15} className="shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{label}</span>
            <span
              className={cn(
                'shrink-0 text-[10px] text-[var(--text-muted)] transition-transform',
                open && 'rotate-180'
              )}
            >
              ▼
            </span>
          </>
        )}
      </button>
      {!collapsed && open && (
        <div className="overflow-hidden rounded-b-[var(--radius-md)] border-t border-[var(--border-light)] bg-[var(--surface)] pb-1">
          {children}
        </div>
      )}
    </div>
  );
}

export function ClientDashboardNav({
  collapsed,
  integrationsConfigured,
  moduleStatuses,
  onNavigate,
}: ClientDashboardNavProps) {
  const pathname = usePathname();
  const activeTab = tabFromPathname(pathname);

  const moduleConfigured = (moduleId: ModuleId) =>
    moduleStatuses.find((m) => m.id === moduleId)?.configured === true;

  const isTabDisabled = (tabId: string) => {
    if (tabId === CLIENT_BRAND_CONTEXT_TAB_ID) return false;
    const moduleId = moduleForTab(tabId);
    if (!moduleId) return !integrationsConfigured;
    return !moduleStatuses.find((m) => m.id === moduleId)?.configured;
  };

  const disabledTitle = 'Configure required API keys in Settings first';

  const metaAdsActive = activeTab ? CLIENT_META_ADS_TABS.some((t) => t.id === activeTab) : false;
  const socialActive = activeTab ? CLIENT_SOCIAL_TABS.some((t) => t.id === activeTab) : false;
  const newsletterActive = activeTab ? CLIENT_NEWSLETTER_TABS.some((t) => t.id === activeTab) : false;
  const outreachActive = activeTab ? CLIENT_OUTREACH_TABS.some((t) => t.id === activeTab) : false;
  const blogActive = activeTab ? CLIENT_BLOG_TABS.some((t) => t.id === activeTab) : false;

  const [metaAdsOpen, setMetaAdsOpen] = useState(metaAdsActive);
  const [socialOpen, setSocialOpen] = useState(socialActive);
  const [newsletterOpen, setNewsletterOpen] = useState(newsletterActive);
  const [outreachOpen, setOutreachOpen] = useState(outreachActive);
  const [blogOpen, setBlogOpen] = useState(blogActive);

  useEffect(() => {
    if (metaAdsActive) setMetaAdsOpen(true);
    if (socialActive) setSocialOpen(true);
    if (newsletterActive) setNewsletterOpen(true);
    if (outreachActive) setOutreachOpen(true);
    if (blogActive) setBlogOpen(true);
  }, [metaAdsActive, socialActive, newsletterActive, outreachActive, blogActive]);

  const metaLocked = !moduleConfigured('meta');
  const socialLocked = !moduleConfigured('social');
  const newsletterLocked = !moduleConfigured('newsletter');
  const outreachLocked = !moduleConfigured('outreach');
  const blogLocked = !moduleConfigured('blog');

  return (
    <nav className="flex flex-col gap-1">
      {CLIENT_TOP_TABS.map((item) => (
        <NavLink
          key={item.id}
          href={clientWorkspaceHref(item.id)}
          label={item.label}
          icon={item.icon}
          active={activeTab === item.id}
          collapsed={collapsed}
          disabled={isTabDisabled(item.id)}
          disabledTitle={disabledTitle}
          onNavigate={onNavigate}
        />
      ))}

      <NavGroup
        label="Meta Ads"
        icon={Megaphone}
        open={metaAdsOpen}
        onToggle={() => setMetaAdsOpen((o) => !o)}
        active={metaAdsActive}
        collapsed={collapsed}
        disabled={metaLocked}
        disabledTitle={disabledTitle}
      >
        {CLIENT_META_ADS_TABS.map((item) => (
          <NavLink
            key={item.id}
            href={clientWorkspaceHref(item.id)}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            collapsed={false}
            indent
            disabled={isTabDisabled(item.id)}
            disabledTitle={disabledTitle}
            onNavigate={onNavigate}
          />
        ))}
      </NavGroup>

      <NavGroup
        label="Social Channels"
        icon={Share2}
        open={socialOpen}
        onToggle={() => setSocialOpen((o) => !o)}
        active={socialActive}
        collapsed={collapsed}
        disabled={socialLocked}
        disabledTitle={disabledTitle}
      >
        {CLIENT_SOCIAL_TABS.map((item) => (
          <NavLink
            key={item.id}
            href={clientWorkspaceHref(item.id)}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            collapsed={false}
            indent
            disabled={isTabDisabled(item.id)}
            disabledTitle={disabledTitle}
            onNavigate={onNavigate}
          />
        ))}
      </NavGroup>

      <NavGroup
        label="Newsletter"
        icon={Newspaper}
        open={newsletterOpen}
        onToggle={() => setNewsletterOpen((o) => !o)}
        active={newsletterActive}
        collapsed={collapsed}
        disabled={newsletterLocked}
        disabledTitle={disabledTitle}
      >
        {CLIENT_NEWSLETTER_TABS.map((item) => (
          <NavLink
            key={item.id}
            href={clientWorkspaceHref(item.id)}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            collapsed={false}
            indent
            disabled={isTabDisabled(item.id)}
            disabledTitle={disabledTitle}
            onNavigate={onNavigate}
          />
        ))}
      </NavGroup>

      <NavGroup
        label="Cold Email"
        icon={Send}
        open={outreachOpen}
        onToggle={() => setOutreachOpen((o) => !o)}
        active={outreachActive}
        collapsed={collapsed}
        disabled={outreachLocked}
        disabledTitle={disabledTitle}
      >
        {CLIENT_OUTREACH_TABS.map((item) => (
          <NavLink
            key={item.id}
            href={clientWorkspaceHref(item.id)}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            collapsed={false}
            indent
            disabled={isTabDisabled(item.id)}
            disabledTitle={disabledTitle}
            onNavigate={onNavigate}
          />
        ))}
      </NavGroup>

      <NavGroup
        label="Blog"
        icon={FileText}
        open={blogOpen}
        onToggle={() => setBlogOpen((o) => !o)}
        active={blogActive}
        collapsed={collapsed}
        disabled={blogLocked}
        disabledTitle={disabledTitle}
      >
        {CLIENT_BLOG_TABS.map((item) => (
          <NavLink
            key={item.id}
            href={clientWorkspaceHref(item.id)}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            collapsed={false}
            indent
            disabled={isTabDisabled(item.id)}
            disabledTitle={disabledTitle}
            onNavigate={onNavigate}
          />
        ))}
      </NavGroup>

      <Link
        href="/client-dashboard/apis"
        title={collapsed ? 'Settings' : undefined}
        onClick={onNavigate}
        className={cn(
          'relative mt-2 flex items-center rounded-[var(--radius-md)] text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]',
          collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
          pathname === '/client-dashboard/apis' &&
            'bg-[var(--primary-light)] font-bold text-[var(--primary-dark)] shadow-[0_1px_3px_rgba(37,99,235,0.12)]'
        )}
      >
        {pathname === '/client-dashboard/apis' && !collapsed && (
          <span className="absolute left-0 top-[20%] h-[60%] w-[3px] rounded-r bg-[var(--primary)]" />
        )}
        <Settings size={15} className="shrink-0" />
        {!collapsed && <span className="truncate">Settings</span>}
      </Link>
    </nav>
  );
}
