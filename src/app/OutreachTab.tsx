'use client';

const OUTREACH_PATHS: Record<string, string> = {
  'outreach-dashboard': '/outreach',
  'outreach-campaigns': '/outreach/campaigns',
  'outreach-analytics': '/outreach/analytics',
  'outreach-scraper': '/outreach/scraper',
  'outreach-scraper-history': '/outreach/scraper/history',
  'outreach-cleanup': '/outreach/cleanup',
};

export default function OutreachTab({ activeTab }: { activeTab: string }) {
  const path = OUTREACH_PATHS[activeTab] ?? '/outreach';
  const src = `${path}?embed=1`;

  return (
    <div
      className="animate-fade-in"
      style={{
        margin: '-24px -32px -4rem',
        height: 'calc(100vh - 64px)',
        minHeight: 560,
      }}
    >
      <iframe
        key={src}
        src={src}
        title="Cold Email"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          background: '#f8f9fa',
        }}
      />
    </div>
  );
}
