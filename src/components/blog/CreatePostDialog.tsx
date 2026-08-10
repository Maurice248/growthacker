'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  PartyPopper,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { BlogCategoryData, BlogJobStatus } from '@/lib/blog/types';
import { cn } from '@/lib/utils';

type DialogPhase = 'select' | 'generating' | 'success' | 'error';

const STATUS_LABELS: Record<BlogJobStatus, string> = {
  pending: 'Starting blog generation...',
  keywords: 'Researching SEO keywords via DataForSEO...',
  outline: 'Generating title and outline...',
  writing: 'Writing the full article...',
  image_prompt: 'Crafting featured image prompt...',
  image: 'Creating featured image with kie.ai...',
  publishing: 'Publishing post to WordPress...',
  done: 'Post published successfully!',
  error: 'Generation failed',
};

const STATUS_PROGRESS: Record<BlogJobStatus, number> = {
  pending: 5,
  keywords: 15,
  outline: 30,
  writing: 50,
  image_prompt: 65,
  image: 80,
  publishing: 90,
  done: 100,
  error: 0,
};

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreatePostDialog({ open, onOpenChange, onCreated }: CreatePostDialogProps) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<DialogPhase>('select');
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [completedCategory, setCompletedCategory] = useState<BlogCategoryData | null>(null);
  const [postUrl, setPostUrl] = useState<string | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlightRef = useRef(false);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: async () => {
      const res = await fetch('/api/blog/categories');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load categories');
      return json as { categories: BlogCategoryData[]; source: string };
    },
    enabled: open,
    staleTime: 0,
  });

  const categories = categoriesData?.categories ?? [];
  const selectedCategory = categories.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedId && !categories.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [categories, selectedId]);

  function clearTimers() {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollInFlightRef.current = false;
  }

  function resetDialog() {
    clearTimers();
    setPhase('select');
    setElapsed(0);
    setProgress(0);
    setStatusText('');
    setErrorMessage('');
    setCompletedCategory(null);
    setPostUrl(null);
    setSelectedId(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && phase === 'generating') return;
    if (!nextOpen) resetDialog();
    onOpenChange(nextOpen);
  }

  function startElapsedTimer() {
    setElapsed(0);
    elapsedRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }

  async function pollJob(jobId: string) {
    const res = await fetch('/api/blog/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    const json = await res.json();

    if (json.job) {
      const status = json.job.status as BlogJobStatus;
      setStatusText(STATUS_LABELS[status] || status);
      setProgress(STATUS_PROGRESS[status] ?? progress);

      if (status === 'done') {
        return { done: true, postUrl: json.job.wordpressPostUrl as string | null };
      }
      if (status === 'error') {
        throw new Error(json.job.errorMessage || json.error || 'Blog generation failed');
      }
    }

    if (!res.ok && !json.pending) {
      throw new Error(json.error || 'Failed to poll blog job');
    }

    return { done: false, postUrl: null };
  }

  function startPolling(jobId: string, category: BlogCategoryData) {
    pollRef.current = setInterval(async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const result = await pollJob(jobId);
        if (result.done) {
          clearTimers();
          setCompletedCategory(category);
          setPostUrl(result.postUrl);
          setProgress(100);
          setPhase('success');
          toast({
            title: 'Post published!',
            description: `"${category.category}" was generated and published to WordPress.`,
          });
          onCreated?.();
        }
      } catch (err) {
        clearTimers();
        setErrorMessage(err instanceof Error ? err.message : 'Blog generation failed');
        setPhase('error');
      } finally {
        pollInFlightRef.current = false;
      }
    }, 5000);
  }

  async function handleCreatePost() {
    if (!selectedCategory) {
      toast({
        title: 'Select a category',
        description: `Choose one of the ${categories.length || ''} blog categories to continue.`,
        variant: 'destructive',
      });
      return;
    }

    setPhase('generating');
    setErrorMessage('');
    setProgress(2);
    setStatusText(STATUS_LABELS.pending);
    startElapsedTimer();

    try {
      const res = await fetch('/api/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCategory.id }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string' ? json.error : 'Failed to start blog generation'
        );
      }

      const jobId = String(json.jobId || '');
      if (!jobId) {
        throw new Error('No job ID returned from blog generation');
      }

      const firstPoll = await pollJob(jobId);
      if (firstPoll.done) {
        clearTimers();
        setCompletedCategory(selectedCategory);
        setPostUrl(firstPoll.postUrl);
        setProgress(100);
        setPhase('success');
        toast({
          title: 'Post published!',
          description: `"${selectedCategory.category}" was generated and published to WordPress.`,
        });
        onCreated?.();
        return;
      }

      startPolling(jobId, selectedCategory);
    } catch (err) {
      clearTimers();
      setErrorMessage(err instanceof Error ? err.message : 'Could not create post');
      setPhase('error');
    }
  }

  function handleDone() {
    resetDialog();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0',
          phase === 'select' ? 'max-w-2xl' : 'max-w-md'
        )}
        onInteractOutside={(event) => {
          if (phase === 'generating') event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (phase === 'generating') event.preventDefault();
        }}
      >
        {phase === 'select' && (
          <>
            <DialogHeader className="border-b px-6 py-5 text-left">
              <DialogTitle className="text-xl">Create Post</DialogTitle>
              <DialogDescription>
                Choose a blog category configured in Automation. The native pipeline will research
                keywords, write the article, generate a featured image, and publish to WordPress.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {categoriesLoading && (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              )}

              {categoriesError && !categoriesLoading && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-800">
                  <AlertCircle className="h-5 w-5" />
                  <p>
                    {categoriesError instanceof Error
                      ? categoriesError.message
                      : 'Failed to load categories'}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetchCategories()}>
                    Retry
                  </Button>
                </div>
              )}

              {!categoriesLoading && !categoriesError && (
                <div className="grid gap-2">
                  {categories.map((item, index) => (
                    <CategoryOption
                      key={item.id}
                      item={item}
                      index={index + 1}
                      selected={selectedId === item.id}
                      onSelect={() => setSelectedId(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {selectedCategory && (
              <div className="border-t bg-gray-50 px-6 py-3 text-sm text-gray-600">
                <span className="font-medium text-gray-900">Seed keyword:</span>{' '}
                {selectedCategory.seedKeyword}
                <span className="mx-2 text-gray-300">·</span>
                <span className="font-medium text-gray-900">Service:</span> {selectedCategory.service}
              </div>
            )}

            <DialogFooter className="border-t px-6 py-4 sm:justify-between">
              <p className="text-xs text-gray-400 sm:mr-auto">
                {selectedCategory
                  ? `Category selected`
                  : categoriesLoading
                    ? 'Loading categories...'
                    : `${categories.length} categories available`}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!selectedCategory || categoriesLoading}
                  className="bg-[#003049] text-white hover:bg-[#1A4A66]"
                  onClick={handleCreatePost}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Post
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {phase === 'generating' && (
          <div className="px-6 py-8 text-center">
            <div className="relative mx-auto mb-6 h-20 w-20">
              <div className="absolute inset-0 rounded-full border-4 border-[#003049]/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-[#003049] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-[#003049]" />
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900">Generating Blog Post</h3>
            {selectedCategory && (
              <p className="mt-1 text-sm text-gray-500">{selectedCategory.category}</p>
            )}
            <p className="mt-3 min-h-[20px] text-sm font-medium text-[#003049] transition-all">
              {statusText}
            </p>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#003049] transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{elapsed}s elapsed · typically 3–5 minutes</span>
            </div>

            <p className="mt-4 text-xs text-gray-400">
              Please keep this dialog open while the native pipeline completes
            </p>
          </div>
        )}

        {phase === 'success' && (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <PartyPopper className="h-10 w-10 text-green-600" />
            </div>

            <h3 className="text-xl font-bold text-gray-900">Post successful!</h3>
            <p className="mt-2 text-sm text-gray-500">
              {completedCategory
                ? `"${completedCategory.category}" has been published to WordPress.`
                : 'Your blog post was published successfully.'}
            </p>

            {postUrl && (
              <a
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#003049] hover:underline"
              >
                View published post
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            <div className="mx-auto mt-6 max-w-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Progress</span>
                <span className="font-semibold text-green-600">100%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-full rounded-full bg-green-500" />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              Published to WordPress
            </div>

            <Button
              className="mt-8 w-full bg-[#003049] text-white hover:bg-[#1A4A66]"
              onClick={handleDone}
            >
              Done
            </Button>
          </div>
        )}

        {phase === 'error' && (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>

            <h3 className="text-xl font-bold text-gray-900">Generation failed</h3>
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
              {errorMessage}
            </p>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleDone}>
                Close
              </Button>
              <Button
                className="flex-1 bg-[#003049] text-white hover:bg-[#1A4A66]"
                onClick={() => {
                  setPhase('select');
                  setErrorMessage('');
                  setProgress(0);
                  setElapsed(0);
                }}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryOption({
  item,
  index,
  selected,
  onSelect,
}: {
  item: BlogCategoryData;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border px-4 py-3 text-left transition-all',
        selected
          ? 'border-[#003049] bg-[#003049]/5 ring-1 ring-[#003049]/30'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                selected ? 'bg-[#003049] text-white' : 'bg-gray-100 text-gray-600'
              )}
            >
              {index}
            </span>
            <p className="font-medium text-gray-900">{item.category}</p>
          </div>
          <p className="mt-1 pl-8 text-xs text-gray-500">
            Seed: <span className="font-medium text-gray-700">{item.seedKeyword}</span>
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {item.service}
        </Badge>
      </div>
    </button>
  );
}
