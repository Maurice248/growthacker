'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertCircle, FileText, Sparkles } from 'lucide-react';
import { EditorialStatusPill } from '@/app/components';
import {
  EditorialPage,
  EditorialPageHeader,
  EditorialSectionHeader,
  EditorialStatCell,
  EditorialStatRibbon,
  editorialTextLinkClass,
} from '@/components/editorial/editorial-layout';
import { Skeleton } from '@/components/ui/skeleton';
import type { BlogConfigData, BlogJobStatus, BlogJobView } from '@/lib/blog/types';

type OverviewResponse = {
  config: BlogConfigData | null;
  context: { companyName: string };
  stats: {
    activeCategories: number;
    totalCategories: number;
    jobsCompleted: number;
    jobsFailed: number;
    jobsInProgress: number;
  };
  recentJobs: BlogJobView[];
  error?: string;
};

type PostsResponse = {
  configured?: boolean;
  posts?: Array<{ status: string }>;
  error?: string;
};

function formatSchedule(config: BlogConfigData) {
  const hour = String(config.runHour).padStart(2, '0');
  const minute = String(config.runMinute).padStart(2, '0');
  const tz = config.runTimezone?.trim() || 'UTC';
  const days = config.daysInterval === 1 ? 'Every day' : `Every ${config.daysInterval} days`;
  return `${days} · ${hour}:${minute} ${tz}`;
}

function jobStatusLabel(status: BlogJobStatus) {
  if (status === 'done') return 'Published';
  if (status === 'error') return 'Failed';
  if (status === 'pending') return 'Queued';
  return 'In progress';
}

function jobStatusVariant(status: BlogJobStatus): 'approved' | 'unapproved' | 'neutral' {
  if (status === 'done') return 'approved';
  if (status === 'error') return 'unapproved';
  return 'neutral';
}

export function BlogOverview() {
  const overviewQuery = useQuery({
    queryKey: ['blog-overview'],
    queryFn: async () => {
      const res = await fetch('/api/blog/overview', { cache: 'no-store' });
      const json = (await res.json()) as OverviewResponse;
      if (!res.ok) throw new Error(json.error ?? 'Failed to load blog overview');
      return json;
    },
  });

  const postsQuery = useQuery({
    queryKey: ['wordpress-posts-overview'],
    queryFn: async () => {
      const res = await fetch('/api/blog/posts?per_page=100');
      const json = (await res.json()) as PostsResponse;
      if (!res.ok && json.configured !== false) {
        throw new Error(json.error ?? 'Failed to load WordPress posts');
      }
      return json;
    },
  });

  const loading = overviewQuery.isLoading;
  const overview = overviewQuery.data;
  const config = overview?.config;
  const stats = overview?.stats;
  const posts = postsQuery.data?.posts ?? [];
  const publishedCount = posts.filter((p) => p.status === 'publish').length;
  const draftCount = posts.filter((p) => p.status === 'draft').length;
  const wpConfigured = postsQuery.data?.configured !== false;

  return (
    <EditorialPage>
      <EditorialPageHeader
        eyebrow="Blog"
        title="Overview"
        subtitle={
          overview?.context.companyName
            ? `Blog automation and publishing summary for ${overview.context.companyName}.`
            : 'Blog automation and publishing summary.'
        }
      />

      {overviewQuery.error && (
        <div className="mb-8 flex items-center gap-2 border-t border-[var(--border)] py-4 text-sm text-[var(--red)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {overviewQuery.error instanceof Error ? overviewQuery.error.message : 'Failed to load overview'}
        </div>
      )}

      {loading ? (
        <div className="space-y-8">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <EditorialStatRibbon columns={4}>
            <EditorialStatCell
              isFirst
              value={wpConfigured ? publishedCount : '—'}
              label="Published posts"
              sub={wpConfigured ? `${draftCount} drafts in WordPress` : 'WordPress not configured'}
            />
            <EditorialStatCell
              value={stats?.jobsCompleted ?? 0}
              label="Posts generated"
              sub={`${stats?.jobsInProgress ?? 0} in progress`}
            />
            <EditorialStatCell
              value={stats?.activeCategories ?? 0}
              label="Active categories"
              sub={`${stats?.totalCategories ?? 0} total configured`}
            />
            <EditorialStatCell
              isLast
              value={config?.active ? 'Active' : 'Paused'}
              label="Automation"
              sub={config ? formatSchedule(config) : 'Not configured yet'}
              accent={config?.active ? 'default' : 'muted'}
            />
          </EditorialStatRibbon>

          {!wpConfigured && (
            <div className="mt-8 border-t border-[var(--border)] py-4 text-sm text-[var(--red)]">
              <p className="font-medium">WordPress is not configured</p>
              <p className="mt-1 text-[#6B7A6E]">
                Add WordPress credentials in Client Dashboard → API keys to publish posts.
              </p>
            </div>
          )}

          <section className="mt-12">
            <EditorialSectionHeader
              title="Recent generation activity"
              meta={`${overview?.recentJobs.length ?? 0} recent jobs`}
            />

            {(overview?.recentJobs.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center border-b border-[var(--border)] py-16 text-[#B0A88F]">
                <Sparkles className="mb-3 h-12 w-12 opacity-30" />
                <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--primary)]">
                  No generation jobs yet
                </p>
                <p className="mt-1 text-sm">Create a post or enable automation to get started</p>
              </div>
            ) : (
              overview?.recentJobs.map((job) => {
                const title = job.title || job.slug || `Job ${job.id.slice(0, 8)}`;
                return (
                  <div
                    key={job.id}
                    className="grid grid-cols-1 items-center gap-8 border-b border-[var(--border)] py-5 sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="font-[family-name:var(--font-display)] text-[16.5px] font-semibold tracking-[-0.2px] text-[var(--primary)]">
                        {title}
                      </div>
                      <div className="mt-1.5 text-xs text-[#B0A88F]">
                        {format(new Date(job.createdAt), 'MMM dd, yyyy · h:mm a')}
                        {job.errorMessage ? ` · ${job.errorMessage}` : ''}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-4">
                      <EditorialStatusPill variant={jobStatusVariant(job.status)}>
                        {jobStatusLabel(job.status)}
                      </EditorialStatusPill>
                      {job.wordpressPostUrl && (
                        <a
                          href={job.wordpressPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={editorialTextLinkClass}
                        >
                          View
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <section className="mt-12">
            <EditorialSectionHeader title="Quick links" />
            <div className="flex flex-wrap gap-6 border-b border-[var(--border)] py-5">
              <a href="/blog" className={`inline-flex items-center gap-2 ${editorialTextLinkClass}`}>
                <FileText className="h-4 w-4" />
                Manage blog posts
              </a>
              <a href="/blog/automation" className={`inline-flex items-center gap-2 ${editorialTextLinkClass}`}>
                <Sparkles className="h-4 w-4" />
                Automation settings
              </a>
            </div>
          </section>
        </>
      )}

      <div className="mt-14 text-xs text-[#B0A88F]">version 0.3</div>
    </EditorialPage>
  );
}
