'use client';

const BLOG_PATHS: Record<string, string> = {
  'blog-post': '/blog',
  'blog-automation': '/blog/automation',
  'blog-management': '/blog',
};

export default function BlogTab({ activeTab }: { activeTab: string }) {
  const path = BLOG_PATHS[activeTab] ?? '/blog';
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
        title="Blog"
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
