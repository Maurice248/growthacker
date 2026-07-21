'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertCircle, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { CreatePostDialog } from '@/components/blog/CreatePostDialog';
import { OutreachActionLink } from '@/components/cold-email/outreach-ui';
import {
  EditorialPage,
  EditorialPageHeader,
  EditorialSectionHeader,
  editorialPillButtonClass,
} from '@/components/editorial/editorial-layout';
import { EditorialStatusPill } from '@/app/components';

interface WordPressPost {
  id: number;
  date: string;
  status: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
}

interface PostsResponse {
  configured?: boolean;
  posts?: WordPressPost[];
  error?: string;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function postStatusLabel(status: string) {
  if (status === 'publish') return 'Published';
  if (status === 'draft') return 'Draft';
  if (status === 'pending') return 'Pending';
  return status.replace(/_/g, ' ');
}

function postStatusVariant(status: string): 'approved' | 'unapproved' | 'neutral' {
  if (status === 'publish') return 'approved';
  if (status === 'pending') return 'unapproved';
  return 'neutral';
}

export default function BlogManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [createPostOpen, setCreatePostOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['wordpress-posts'],
    queryFn: async () => {
      const res = await fetch('/api/blog/posts');
      const json = (await res.json()) as PostsResponse;
      if (!res.ok) throw new Error(json.error ?? 'Failed to load posts');
      return json;
    },
  });

  async function handleDelete(post: WordPressPost) {
    const title = stripHtml(post.title.rendered) || `Post #${post.id}`;
    if (!confirm(`Delete "${title}" from WordPress?`)) return;

    setDeletingId(post.id);
    try {
      const res = await fetch(`/api/blog/posts/${post.id}?force=true`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Delete failed');
      queryClient.invalidateQueries({ queryKey: ['wordpress-posts'] });
      toast({ title: 'Post deleted', description: `"${title}" was removed from WordPress.` });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not delete post',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  }

  const posts = data?.posts ?? [];
  const notConfigured = data?.configured === false;

  return (
    <EditorialPage>
      <EditorialPageHeader
        eyebrow="Blog"
        title="Blog Posts Management"
        subtitle="Manage AI-generated blog posts with in-dashboard approval."
        actions={
          <button type="button" className={editorialPillButtonClass} onClick={() => setCreatePostOpen(true)}>
            + Create post
          </button>
        }
      />

      <CreatePostDialog
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['wordpress-posts'] })}
      />

      {notConfigured && (
        <div className="mb-8 border-t border-[var(--border)] py-4 text-sm text-[var(--red)]">
          <p className="font-medium">WordPress is not configured</p>
          <p className="mt-1 text-[#6B7A6E]">
            Add WordPress credentials in Client Dashboard → API keys, or set WORDPRESS_* in your .env.
          </p>
        </div>
      )}

      <section>
        <EditorialSectionHeader title="Post History" meta={`${posts.length} posts`} />

        {isLoading && (
          <div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-b border-[var(--border)] py-5">
                <Skeleton className="mb-2 h-5 w-3/4 max-w-md" />
                <Skeleton className="mb-2 h-4 w-full max-w-lg" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        )}

        {error && !notConfigured && (
          <div className="flex items-center justify-center gap-2 border-b border-[var(--border)] py-8 text-[var(--red)]">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error instanceof Error ? error.message : 'Failed to load posts'}
          </div>
        )}

        {!isLoading && !error && posts.length === 0 && !notConfigured && (
          <div className="flex flex-col items-center justify-center border-b border-[var(--border)] py-16 text-[#B0A88F]">
            <FileText className="mb-3 h-12 w-12 opacity-30" />
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--primary)]">
              No blog posts yet
            </p>
            <p className="mt-1 text-sm">Create your first post to get started</p>
          </div>
        )}

        {posts.map((post) => {
          const title = stripHtml(post.title.rendered) || `Post #${post.id}`;
          const excerpt = stripHtml(post.excerpt.rendered);

          return (
            <div
              key={post.id}
              className="grid grid-cols-1 items-center gap-8 border-b border-[var(--border)] py-5 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="font-[family-name:var(--font-display)] text-[16.5px] font-semibold tracking-[-0.2px] text-[var(--primary)]">
                  {title}
                </div>
                {excerpt && (
                  <div className="mt-1 truncate text-[13.5px] text-[var(--text-muted)]">{excerpt}</div>
                )}
                <div className="mt-1.5 text-xs text-[#B0A88F]">
                  {format(new Date(post.date), 'MMM dd, yyyy')} · ID {post.id}
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <EditorialStatusPill variant={postStatusVariant(post.status)}>
                  {postStatusLabel(post.status)}
                </EditorialStatusPill>
                <a
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-b border-[var(--border-mid)] text-[13.5px] font-bold text-[var(--primary)] transition-colors hover:border-[var(--red)] hover:text-[var(--red)]"
                >
                  View
                </a>
                <OutreachActionLink
                  variant="muted"
                  disabled={deletingId === post.id}
                  onClick={() => handleDelete(post)}
                >
                  {deletingId === post.id ? 'Deleting…' : 'Delete'}
                </OutreachActionLink>
              </div>
            </div>
          );
        })}
      </section>

      <div className="mt-14 text-xs text-[#B0A88F]">version 0.2</div>
    </EditorialPage>
  );
}
