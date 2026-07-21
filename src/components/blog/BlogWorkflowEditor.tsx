'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
  EditorialPillButton,
} from '@/app/components';
import { EditorialSectionHeader } from '@/components/editorial/editorial-layout';
import {
  OutreachActionLink,
  OutreachMetricInput,
  OutreachSelect,
} from '@/components/cold-email/outreach-ui';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { buildTimezoneSelectOptions, fromTimezoneSelectValue, toTimezoneSelectValue } from '@/lib/timezones';
import type { BlogCategoryData, BlogConfigData } from '@/lib/blog/types';

type ConfigResponse = {
  config: BlogConfigData | null;
  context: { companyName: string };
};

type CategoriesResponse = {
  categories: BlogCategoryData[];
  source: string;
};

const DEFAULT_CONFIG: BlogConfigData = {
  titlePrompt: '',
  titleUserPrompt: '',
  articleSystemPrompt: '',
  articleUserPrompt: '',
  imagePromptSystem: '',
  runHour: 7,
  runMinute: 0,
  runTimezone: 'UTC',
  daysInterval: 3,
  active: true,
  postStatus: 'publish',
  imageSize: '16:9',
  dataForSeoLocationCode: 2124,
  openAiModel: 'gpt-4o-mini',
  lastCategoryIndex: 0,
  lastRunAt: null,
};

const PROMPT_FIELDS = [
  { key: 'titlePrompt' as const, label: 'Title & outline system prompt' },
  { key: 'titleUserPrompt' as const, label: 'Title & outline user prompt template' },
  { key: 'articleSystemPrompt' as const, label: 'Article system prompt' },
  { key: 'articleUserPrompt' as const, label: 'Article user prompt template' },
  { key: 'imagePromptSystem' as const, label: 'Featured image system prompt' },
];

const METRIC_GRID_CLASS =
  'grid border-b border-[var(--border)] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

function MetricCell({
  label,
  children,
  isFirst,
  isLast,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <div
      className={[
        'py-6',
        !isLast && 'border-[var(--border)] lg:border-r',
        isFirst ? 'pr-0 sm:pr-6' : isLast ? 'pl-0 sm:pl-6' : 'px-0 sm:px-6',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</div>
      {children}
    </div>
  );
}

function formatScheduleMeta(config: BlogConfigData) {
  const hour = String(config.runHour).padStart(2, '0');
  const minute = String(config.runMinute).padStart(2, '0');
  const tz = config.runTimezone?.trim() || 'UTC';
  const days = config.daysInterval === 1 ? 'Every day' : `Every ${config.daysInterval} days`;
  return `${days} · ${hour}:${minute} ${tz}`;
}

function CategoryFieldGrid({
  fields,
}: {
  fields: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }[];
}) {
  return (
    <div
      className="mt-3.5 grid items-baseline gap-x-10 gap-y-2.5"
      style={{ gridTemplateColumns: '200px minmax(0, 1fr)' }}
    >
      {fields.map((field) => (
        <div key={field.label} className="contents">
          <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {field.label}
          </div>
          <EditorialField
            value={field.value}
            onChange={field.onChange}
            multiline={field.multiline}
            rows={field.multiline ? 2 : undefined}
          />
        </div>
      ))}
    </div>
  );
}

export function BlogWorkflowEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draftConfig, setDraftConfig] = useState<BlogConfigData>(DEFAULT_CONFIG);
  const [draftCategories, setDraftCategories] = useState<BlogCategoryData[]>([]);

  const configQuery = useQuery({
    queryKey: ['blog-config'],
    queryFn: async () => {
      const res = await fetch('/api/blog/config', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load blog config');
      return json as ConfigResponse;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ['blog-categories'],
    queryFn: async () => {
      const res = await fetch('/api/blog/categories', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load categories');
      return json as CategoriesResponse;
    },
  });

  useEffect(() => {
    if (configQuery.data?.config) {
      setDraftConfig({ ...DEFAULT_CONFIG, ...configQuery.data.config });
    }
  }, [configQuery.data]);

  useEffect(() => {
    if (categoriesQuery.data?.categories) {
      setDraftCategories(categoriesQuery.data.categories);
    }
  }, [categoriesQuery.data]);

  const saveConfigMutation = useMutation({
    mutationFn: async (config: BlogConfigData) => {
      const res = await fetch('/api/blog/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save config');
      return json.config as BlogConfigData;
    },
    onSuccess: (config) => {
      setDraftConfig(config);
      queryClient.invalidateQueries({ queryKey: ['blog-config'] });
      toast({ title: 'Saved', description: 'Blog automation settings updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async (category: BlogCategoryData) => {
      const isNew = category.id.startsWith('new-');
      const payload = {
        ...category,
        keywords: category.keywords,
      };
      const res = await fetch('/api/blog/categories', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isNew
            ? {
                service: payload.service,
                category: payload.category,
                seedKeyword: payload.seedKeyword,
                keywords: payload.keywords,
                sortOrder: payload.sortOrder,
                active: payload.active,
              }
            : payload
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save category');
      return json.category as BlogCategoryData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
      toast({ title: 'Category saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Category save failed', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blog/categories?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete category');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
      toast({ title: 'Category deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });

  const timezoneOptions = useMemo(
    () => buildTimezoneSelectOptions(draftConfig.runTimezone),
    [draftConfig.runTimezone]
  );

  const isLoading = configQuery.isLoading || categoriesQuery.isLoading;
  const loadError = configQuery.error || categoriesQuery.error;

  function updateCategory(index: number, patch: Partial<BlogCategoryData>) {
    setDraftCategories((prev) =>
      prev.map((cat, i) => (i === index ? { ...cat, ...patch } : cat))
    );
  }

  function addCategory() {
    setDraftCategories((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        service: '',
        category: '',
        seedKeyword: '',
        keywords: [],
        sortOrder: prev.length,
        active: true,
      },
    ]);
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-12 h-8 w-48" />
        <Skeleton className="mb-8 h-24 w-full" />
        <Skeleton className="mb-8 h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="border-t border-[var(--border)] py-6 text-sm text-[var(--red)]">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          Failed to load blog automation settings
        </div>
        <p className="mt-2 text-[#4A5A64]">
          {loadError instanceof Error ? loadError.message : 'Unknown error'}
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 border-b border-[var(--border-mid)] text-sm font-bold text-[var(--primary)] hover:border-[var(--red)] hover:text-[var(--red)]"
          onClick={() => {
            configQuery.refetch();
            categoriesQuery.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Schedule */}
      <section>
        <EditorialSectionHeader
          title="Schedule"
          meta={formatScheduleMeta(draftConfig)}
        />

        <div className={METRIC_GRID_CLASS}>
          <MetricCell label="Run hour (0–23)" isFirst>
            <OutreachMetricInput
              value={String(draftConfig.runHour)}
              onChange={(v) => setDraftConfig((c) => ({ ...c, runHour: Number(v) }))}
              min={0}
              max={23}
            />
          </MetricCell>
          <MetricCell label="Run minute">
            <OutreachMetricInput
              value={String(draftConfig.runMinute)}
              onChange={(v) => setDraftConfig((c) => ({ ...c, runMinute: Number(v) }))}
              min={0}
              max={59}
            />
          </MetricCell>
          <MetricCell label="Days between posts">
            <OutreachMetricInput
              value={String(draftConfig.daysInterval)}
              onChange={(v) => setDraftConfig((c) => ({ ...c, daysInterval: Number(v) }))}
              min={1}
              max={31}
            />
          </MetricCell>
          <MetricCell label="Timezone" isLast>
            <OutreachSelect
              value={toTimezoneSelectValue(draftConfig.runTimezone)}
              onChange={(value) =>
                setDraftConfig((c) => ({
                  ...c,
                  runTimezone: fromTimezoneSelectValue(value),
                }))
              }
              options={timezoneOptions}
            />
          </MetricCell>
        </div>

        <div className="flex flex-wrap items-baseline gap-4 pt-5">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={draftConfig.active}
              onChange={(e) => setDraftConfig((c) => ({ ...c, active: e.target.checked }))}
              className="h-[15px] w-[15px] accent-[var(--red)]"
            />
            Enable scheduled blog generation
          </label>
          <EditorialPillButton
            disabled={saveConfigMutation.isPending}
            onClick={() => saveConfigMutation.mutate(draftConfig)}
            style={{ marginLeft: 'auto' }}
          >
            {saveConfigMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save schedule'
            )}
          </EditorialPillButton>
        </div>
      </section>

      {/* AI Prompts */}
      <section className="mt-12">
        <EditorialSectionHeader
          title="AI Prompts"
          meta="Empty fields fall back to brand-config defaults"
        />

        <EditorialDefinitionList>
          {PROMPT_FIELDS.map((field, index) => (
            <EditorialDefinitionRow
              key={field.key}
              label={field.label}
              isLast={index === PROMPT_FIELDS.length - 1}
            >
              <EditorialField
                value={draftConfig[field.key]}
                onChange={(value) => setDraftConfig((c) => ({ ...c, [field.key]: value }))}
                multiline
                rows={4}
                placeholder="Leave empty for brand-aware default"
              />
            </EditorialDefinitionRow>
          ))}
        </EditorialDefinitionList>

        <div className="flex justify-end pt-5">
          <EditorialPillButton
            disabled={saveConfigMutation.isPending}
            onClick={() => saveConfigMutation.mutate(draftConfig)}
          >
            {saveConfigMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save AI prompts'
            )}
          </EditorialPillButton>
        </div>
      </section>

      {/* Publishing */}
      <section className="mt-12">
        <EditorialSectionHeader title="Publishing" />

        <div className={METRIC_GRID_CLASS}>
          <MetricCell label="WordPress post status" isFirst>
            <OutreachSelect
              value={draftConfig.postStatus}
              onChange={(value) => setDraftConfig((c) => ({ ...c, postStatus: value }))}
              options={[
                { value: 'publish', label: 'Publish' },
                { value: 'draft', label: 'Draft' },
                { value: 'pending', label: 'Pending review' },
              ]}
            />
          </MetricCell>
          <MetricCell label="Featured image size">
            <OutreachSelect
              value={draftConfig.imageSize}
              onChange={(value) => setDraftConfig((c) => ({ ...c, imageSize: value }))}
              options={[
                { value: '16:9', label: '16:9' },
                { value: '4:3', label: '4:3' },
                { value: '1:1', label: '1:1' },
              ]}
            />
          </MetricCell>
          <MetricCell label="DataForSEO location">
            <EditorialField
              value={String(draftConfig.dataForSeoLocationCode)}
              onChange={(value) =>
                setDraftConfig((c) => ({
                  ...c,
                  dataForSeoLocationCode: Number(value.replace(/\D/g, '')) || 0,
                }))
              }
            />
          </MetricCell>
          <MetricCell label="OpenAI model" isLast>
            <EditorialField
              value={draftConfig.openAiModel}
              onChange={(value) => setDraftConfig((c) => ({ ...c, openAiModel: value }))}
            />
          </MetricCell>
        </div>

        <div className="flex justify-end pt-5">
          <EditorialPillButton
            disabled={saveConfigMutation.isPending}
            onClick={() => saveConfigMutation.mutate(draftConfig)}
          >
            {saveConfigMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save publishing'
            )}
          </EditorialPillButton>
        </div>
      </section>

      {/* Categories */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between border-b border-[var(--primary)] pb-3.5">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--red)] font-[family-name:var(--font-display)]">
            Categories
          </div>
          <div className="flex flex-wrap items-baseline gap-5">
            <span className="text-[13px] text-[var(--text-muted)]">
              {draftCategories.length} categories — rotated for scheduled posts
            </span>
            <OutreachActionLink onClick={addCategory}>+ Add category</OutreachActionLink>
          </div>
        </div>

        {draftCategories.map((cat, index) => (
          <div key={cat.id} className="border-b border-[var(--border)] py-6">
            <div className="flex flex-wrap items-baseline gap-4">
              <input
                type="text"
                value={cat.service}
                onChange={(e) => updateCategory(index, { service: e.target.value })}
                placeholder="Category name"
                className="min-w-[160px] border-none border-b border-transparent bg-transparent font-[family-name:var(--font-display)] text-[16.5px] font-bold text-[var(--primary)] outline-none placeholder:text-[#B0A88F] focus:border-[var(--border-mid)]"
              />
              <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-[#4A5A64]">
                <input
                  type="checkbox"
                  checked={cat.active}
                  onChange={(e) => updateCategory(index, { active: e.target.checked })}
                  className="h-[13px] w-[13px] accent-[var(--red)]"
                />
                Active in rotation
              </label>
              <div className="ml-auto flex gap-3.5">
                <OutreachActionLink
                  disabled={saveCategoryMutation.isPending}
                  onClick={() => saveCategoryMutation.mutate(cat)}
                >
                  Save
                </OutreachActionLink>
                {!cat.id.startsWith('new-') && (
                  <OutreachActionLink
                    variant="muted"
                    disabled={deleteCategoryMutation.isPending}
                    onClick={() => deleteCategoryMutation.mutate(cat.id)}
                  >
                    Delete
                  </OutreachActionLink>
                )}
              </div>
            </div>

            <CategoryFieldGrid
              fields={[
                {
                  label: 'Blog title',
                  value: cat.category,
                  onChange: (value) => updateCategory(index, { category: value }),
                },
                {
                  label: 'Primary keyword',
                  value: cat.seedKeyword,
                  onChange: (value) => updateCategory(index, { seedKeyword: value }),
                },
                {
                  label: 'SEO keywords',
                  value: cat.keywords.join(', '),
                  onChange: (value) =>
                    updateCategory(index, {
                      keywords: value
                        .split(',')
                        .map((k) => k.trim())
                        .filter(Boolean),
                    }),
                  multiline: true,
                },
              ]}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
