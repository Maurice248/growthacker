'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Megaphone, Newspaper, Send, FileText, Settings, Share2, SlidersHorizontal, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CLIENT_BLOG_TABS,
  CLIENT_HOME_TAB_ID,
  CLIENT_BRAND_CONTEXT_TAB_ID,
  CLIENT_CONFIGURATION_IDS,
  CLIENT_CONFIGURATION_TABS,
  CLIENT_META_ADS_TABS,
  CLIENT_NEWSLETTER_TABS,
  CLIENT_OUTREACH_TABS,
  CLIENT_OUTREACH_FUTURE_TABS,
  CLIENT_SOCIAL_TABS,
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
    'relative flex items-center rounded-none border-l-2 text-[15px] transition-colors',
    collapsed ? 'justify-center border-transparent px-0 py-2.5' : indent ? 'gap-2.5 px-4 py-2 pl-7' : 'gap-2.5 px-4 py-2',
    disabled
      ? 'cursor-not-allowed border-transparent opacity-40'
      : active
        ? 'border-[var(--sidebar-active-border)] bg-[rgba(250,237,205,0.12)] font-bold text-[var(--sidebar-text)]'
        : 'border-transparent font-normal text-[var(--sidebar-muted)] hover:border-[#7FA6BC] hover:bg-[rgba(250,237,205,0.08)] hover:text-[var(--sidebar-text)]'
  );

  if (disabled) {
    return (
      <span title={disabledTitle} className={className}>
        {(collapsed && !indent) && <Icon size={15} className="shrink-0" />}
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
      {(collapsed && !indent) && <Icon size={15} className="shrink-0" />}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function NavGroup({
  label,
  icon: Icon,
  open,
  onHeaderClick,
  active,
  collapsed,
  disabled,
  disabledTitle,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  open: boolean;
  onHeaderClick: () => void;
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
        onClick={disabled ? undefined : onHeaderClick}
        disabled={disabled}
        className={cn(
          'relative flex w-full items-center rounded-none border-l-2 border-transparent text-left text-[15px] transition-colors',
          collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-4 py-2',
          disabled
            ? 'cursor-not-allowed opacity-40'
            : active
              ? 'border-[var(--sidebar-active-border)] bg-[rgba(250,237,205,0.12)] font-bold text-[var(--sidebar-text)]'
              : open
                ? 'bg-[rgba(250,237,205,0.06)] text-[var(--sidebar-text)]'
                : 'font-normal text-[var(--sidebar-muted)] hover:border-[#7FA6BC] hover:bg-[rgba(250,237,205,0.08)] hover:text-[var(--sidebar-text)]'
        )}
      >
        {collapsed && <Icon size={15} className="shrink-0" />}
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
        <div className="overflow-hidden border-t border-[var(--sidebar-border)] bg-[rgba(250,237,205,0.06)] pb-1">
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
  const router = useRouter();
  const activeTab = tabFromPathname(pathname);

  const moduleConfigured = (moduleId: ModuleId) =>
    moduleStatuses.find((m) => m.id === moduleId)?.configured === true;

  const moduleEnabled = (moduleId: ModuleId) =>
    moduleStatuses.find((m) => m.id === moduleId)?.enabled !== false;

  const isTabDisabled = (tabId: string) => {
    if (CLIENT_CONFIGURATION_IDS.has(tabId)) return false;
    const moduleId = moduleForTab(tabId);
    if (!moduleId) return !integrationsConfigured;
    const status = moduleStatuses.find((m) => m.id === moduleId);
    if (!status?.enabled) return true;
    return !status.configured;
  };

  const disabledTitle = 'Configure required API keys in Settings first';

  const metaAdsActive = activeTab ? CLIENT_META_ADS_TABS.some((t) => t.id === activeTab) : false;
  const socialActive = activeTab ? CLIENT_SOCIAL_TABS.some((t) => t.id === activeTab) : false;
  const newsletterActive = activeTab ? CLIENT_NEWSLETTER_TABS.some((t) => t.id === activeTab) : false;
  const outreachActive = activeTab ? CLIENT_OUTREACH_TABS.some((t) => t.id === activeTab) : false;
  const blogActive = activeTab ? CLIENT_BLOG_TABS.some((t) => t.id === activeTab) : false;
  const configurationActive = activeTab
    ? CLIENT_CONFIGURATION_TABS.some((t) => t.id === activeTab)
    : false;

  const [metaAdsOpen, setMetaAdsOpen] = useState(metaAdsActive);
  const [socialOpen, setSocialOpen] = useState(socialActive);
  const [newsletterOpen, setNewsletterOpen] = useState(newsletterActive);
  const [outreachOpen, setOutreachOpen] = useState(outreachActive);
  const [blogOpen, setBlogOpen] = useState(blogActive);
  const [configurationOpen, setConfigurationOpen] = useState(
    configurationActive || !integrationsConfigured
  );

  useEffect(() => {
    if (integrationsConfigured) return;
    if (!activeTab || CLIENT_CONFIGURATION_IDS.has(activeTab)) return;
    router.replace(clientWorkspaceHref(CLIENT_BRAND_CONTEXT_TAB_ID));
  }, [integrationsConfigured, activeTab, router]);

  const collapseAllModules = () => {
    setMetaAdsOpen(false);
    setSocialOpen(false);
    setNewsletterOpen(false);
    setOutreachOpen(false);
    setBlogOpen(false);
    setConfigurationOpen(false);
  };

  const activateModule = (module: 'meta' | 'social' | 'outreach' | 'newsletter' | 'blog' | 'configuration', firstTabId: string) => {
    collapseAllModules();
    if (module === 'meta') setMetaAdsOpen(true);
    else if (module === 'social') setSocialOpen(true);
    else if (module === 'outreach') setOutreachOpen(true);
    else if (module === 'newsletter') setNewsletterOpen(true);
    else if (module === 'blog') setBlogOpen(true);
    else setConfigurationOpen(true);

    if (isTabDisabled(firstTabId)) return;

    router.push(clientWorkspaceHref(firstTabId));
    onNavigate?.();
  };

  const toggleModuleHeader = (
    module: 'meta' | 'social' | 'outreach' | 'newsletter' | 'blog' | 'configuration',
    isActive: boolean,
    isOpen: boolean,
    setOpen: (open: boolean) => void,
    firstTabId: string
  ) => {
    if (isActive && isOpen) {
      setOpen(false);
      return;
    }
    if (isActive && !isOpen) {
      setOpen(true);
      return;
    }
    activateModule(module, firstTabId);
  };

  useEffect(() => {
    setMetaAdsOpen(metaAdsActive);
    setSocialOpen(socialActive);
    setNewsletterOpen(newsletterActive);
    setOutreachOpen(outreachActive);
    setBlogOpen(blogActive);
    setConfigurationOpen(configurationActive || !integrationsConfigured);
  }, [pathname, integrationsConfigured]);

  const metaLocked = moduleEnabled('meta') && !moduleConfigured('meta');
  const socialLocked = moduleEnabled('social') && !moduleConfigured('social');
  const newsletterLocked = moduleEnabled('newsletter') && !moduleConfigured('newsletter');
  const outreachLocked = moduleEnabled('outreach') && !moduleConfigured('outreach');
  const blogLocked = moduleEnabled('blog') && !moduleConfigured('blog');

  return (
    <nav className="flex flex-col gap-1">
      <NavLink
        href={clientWorkspaceHref(CLIENT_HOME_TAB_ID)}
        label="Dashboard"
        icon={LayoutDashboard}
        active={activeTab === CLIENT_HOME_TAB_ID}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />

      {moduleEnabled('meta') && (
      <NavGroup
        label="Meta Ads"
        icon={Megaphone}
        open={metaAdsOpen}
        onHeaderClick={() =>
          toggleModuleHeader('meta', metaAdsActive, metaAdsOpen, setMetaAdsOpen, CLIENT_META_ADS_TABS[0].id)
        }
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
      )}

      {moduleEnabled('social') && (
      <NavGroup
        label="Social Channels"
        icon={Share2}
        open={socialOpen}
        onHeaderClick={() =>
          toggleModuleHeader('social', socialActive, socialOpen, setSocialOpen, CLIENT_SOCIAL_TABS[0].id)
        }
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
      )}

      {moduleEnabled('outreach') && (
      <NavGroup
        label="Cold Email"
        icon={Send}
        open={outreachOpen}
        onHeaderClick={() =>
          toggleModuleHeader('outreach', outreachActive, outreachOpen, setOutreachOpen, CLIENT_OUTREACH_TABS[0].id)
        }
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
      )}

      {CLIENT_OUTREACH_FUTURE_TABS.filter((item) => {
        const moduleId = moduleForTab(item.id);
        return moduleId ? moduleEnabled(moduleId) : false;
      }).map((item) => (
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

      {moduleEnabled('newsletter') && (
      <NavGroup
        label="Newsletter"
        icon={Newspaper}
        open={newsletterOpen}
        onHeaderClick={() =>
          toggleModuleHeader(
            'newsletter',
            newsletterActive,
            newsletterOpen,
            setNewsletterOpen,
            CLIENT_NEWSLETTER_TABS[0].id
          )
        }
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
      )}

      {moduleEnabled('blog') && (
      <NavGroup
        label="Blog"
        icon={FileText}
        open={blogOpen}
        onHeaderClick={() =>
          toggleModuleHeader('blog', blogActive, blogOpen, setBlogOpen, CLIENT_BLOG_TABS[0].id)
        }
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
      )}

      <NavGroup
        label="Configuration"
        icon={SlidersHorizontal}
        open={configurationOpen}
        onHeaderClick={() =>
          toggleModuleHeader(
            'configuration',
            configurationActive,
            configurationOpen,
            setConfigurationOpen,
            CLIENT_CONFIGURATION_TABS[0].id
          )
        }
        active={configurationActive}
        collapsed={collapsed}
      >
        {CLIENT_CONFIGURATION_TABS.map((item) => (
          <NavLink
            key={item.id}
            href={clientWorkspaceHref(item.id)}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            collapsed={false}
            indent
            disabled={false}
            onNavigate={onNavigate}
          />
        ))}
      </NavGroup>

      <Link
        href="/client-dashboard/apis"
        title={collapsed ? 'Settings' : undefined}
        onClick={onNavigate}
        className={cn(
          'relative mt-2 flex items-center rounded-none border-l-2 text-[15px] transition-colors',
          collapsed ? 'justify-center border-transparent px-0 py-2.5' : 'gap-2.5 px-4 py-2',
          pathname.startsWith('/client-dashboard/profile') ||
            pathname.startsWith('/client-dashboard/members') ||
            pathname.startsWith('/client-dashboard/security') ||
            pathname.startsWith('/client-dashboard/apis')
            ? 'border-[var(--sidebar-active-border)] bg-[rgba(250,237,205,0.12)] font-bold text-[var(--sidebar-text)]'
            : 'border-transparent font-normal text-[var(--sidebar-muted)] hover:border-[#7FA6BC] hover:bg-[rgba(250,237,205,0.08)] hover:text-[var(--sidebar-text)]'
        )}
      >
        {collapsed && <Settings size={15} className="shrink-0" />}
        {!collapsed && <span className="truncate">Settings</span>}
      </Link>
    </nav>
  );
}
