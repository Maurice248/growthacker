'use client';

const TAB_PATHS: Record<string, string> = {
  'newsletter-dashboard': '/newsletter/dashboard',
  'newsletter-overview': '/newsletter/overview',
  'newsletter-generate': '/newsletter/generate',
  'newsletter-campaign': '/newsletter/campaign',
  'newsletter-subscribers': '/newsletter/subscribers',
  'newsletter-history': '/newsletter/history',
  'newsletter-services': '/newsletter/services',
};

export default function NewsletterTab({ activeTab }: { activeTab: string }) {
  const path = TAB_PATHS[activeTab] ?? '/newsletter/dashboard';
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
        title="Newsletter"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          background: '#f9fafb',
        }}
      />
    </div>
  );
}
