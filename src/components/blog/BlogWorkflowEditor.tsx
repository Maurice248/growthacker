'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  FileText,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { buildTimezoneSelectOptions, fromTimezoneSelectValue, toTimezoneSelectValue } from '@/lib/timezones';
import type { BlogCategoryData, BlogConfigData } from '@/lib/blog/types';
import { cn } from '@/lib/utils';

type ConfigResponse = {
  config: BlogConfigData | null;
  context: { companyName: string };
};

type CategoriesResponse = {
  categories: BlogCategoryData[];
  source: string;
};

const SECTIONS = [
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'prompts', label: 'AI Prompts', icon: Sparkles },
  { id: 'publishing', label: 'Publishing', icon: FileText },
  { id: 'categories', label: 'Categories', icon: ImageIcon },
] as const;

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

export function BlogWorkflowEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openSectionId, setOpenSectionId] = useState<string>('schedule');
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
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          Failed to load blog automation settings
        </div>
        <p className="mt-2">{loadError instanceof Error ? loadError.message : 'Unknown error'}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            configQuery.refetch();
            categoriesQuery.refetch();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Native blog pipeline for <strong>{configQuery.data?.context.companyName}</strong>. Prompts,
        schedule, and categories are stored per company. Leave prompt fields empty to use smart
        defaults built from your brand config.
      </div>

      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isOpen = openSectionId === section.id;

        return (
          <div key={section.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between px-5 py-4 text-left"
              onClick={() => setOpenSectionId(isOpen ? '' : section.id)}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-gray-600" />
                <span className="font-semibold text-gray-900">{section.label}</span>
              </div>
              <ChevronDown className={cn('h-5 w-5 transition-transform', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-5">
                {section.id === 'schedule' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="space-y-2">
                        <Label>Run hour (0-23)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={23}
                          value={draftConfig.runHour}
                          onChange={(e) =>
                            setDraftConfig((c) => ({ ...c, runHour: Number(e.target.value) }))
                          }
                          className="w-28"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Run minute</Label>
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={draftConfig.runMinute}
                          onChange={(e) =>
                            setDraftConfig((c) => ({ ...c, runMinute: Number(e.target.value) }))
                          }
                          className="w-28"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Days between posts</Label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={draftConfig.daysInterval}
                          onChange={(e) =>
                            setDraftConfig((c) => ({ ...c, daysInterval: Number(e.target.value) }))
                          }
                          className="w-28"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select
                        value={toTimezoneSelectValue(draftConfig.runTimezone)}
                        onValueChange={(value) =>
                          setDraftConfig((c) => ({
                            ...c,
                            runTimezone: fromTimezoneSelectValue(value),
                          }))
                        }
                      >
                        <SelectTrigger className="max-w-md bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {timezoneOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draftConfig.active}
                        onChange={(e) =>
                          setDraftConfig((c) => ({ ...c, active: e.target.checked }))
                        }
                      />
                      Enable scheduled blog generation
                    </label>
                  </div>
                )}

                {section.id === 'prompts' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title & outline system prompt</Label>
                      <Textarea
                        value={draftConfig.titlePrompt}
                        onChange={(e) =>
                          setDraftConfig((c) => ({ ...c, titlePrompt: e.target.value }))
                        }
                        className="min-h-[160px]"
                        placeholder="Leave empty for brand-aware default"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Title & outline user prompt template</Label>
                      <Textarea
                        value={draftConfig.titleUserPrompt}
                        onChange={(e) =>
                          setDraftConfig((c) => ({ ...c, titleUserPrompt: e.target.value }))
                        }
                        className="min-h-[160px]"
                        placeholder="Leave empty for brand-aware default. Placeholders: {{category}}, {{rankedKeywords}}, {{keywords}}, {{today}}"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Article system prompt</Label>
                      <Textarea
                        value={draftConfig.articleSystemPrompt}
                        onChange={(e) =>
                          setDraftConfig((c) => ({ ...c, articleSystemPrompt: e.target.value }))
                        }
                        className="min-h-[160px]"
                        placeholder="Leave empty for brand-aware default"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Article user prompt template</Label>
                      <Textarea
                        value={draftConfig.articleUserPrompt}
                        onChange={(e) =>
                          setDraftConfig((c) => ({ ...c, articleUserPrompt: e.target.value }))
                        }
                        className="min-h-[160px]"
                        placeholder="Leave empty for brand-aware default. Placeholders: {{title}}, {{meta_title}}, {{summary}}, {{body_sections_text}}, {{today}}, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Featured image system prompt</Label>
                      <Textarea
                        value={draftConfig.imagePromptSystem}
                        onChange={(e) =>
                          setDraftConfig((c) => ({ ...c, imagePromptSystem: e.target.value }))
                        }
                        className="min-h-[120px]"
                        placeholder="Leave empty for brand-aware default"
                      />
                    </div>
                  </div>
                )}

                {section.id === 'publishing' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>WordPress post status</Label>
                      <Select
                        value={draftConfig.postStatus}
                        onValueChange={(value) =>
                          setDraftConfig((c) => ({ ...c, postStatus: value }))
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="publish">Publish</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Featured image size</Label>
                      <Select
                        value={draftConfig.imageSize}
                        onValueChange={(value) =>
                          setDraftConfig((c) => ({ ...c, imageSize: value }))
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16:9">16:9</SelectItem>
                          <SelectItem value="1:1">1:1</SelectItem>
                          <SelectItem value="4:3">4:3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>DataForSEO location code</Label>
                      <Input
                        type="number"
                        value={draftConfig.dataForSeoLocationCode}
                        onChange={(e) =>
                          setDraftConfig((c) => ({
                            ...c,
                            dataForSeoLocationCode: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>OpenAI model</Label>
                      <Input
                        value={draftConfig.openAiModel}
                        onChange={(e) =>
                          setDraftConfig((c) => ({ ...c, openAiModel: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}

                {section.id === 'categories' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        {draftCategories.length} categories — rotated for scheduled posts
                      </p>
                      <Button variant="outline" size="sm" onClick={addCategory}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add category
                      </Button>
                    </div>
                    {draftCategories.map((cat, index) => (
                      <div key={cat.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary">{cat.service || 'Service'}</Badge>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saveCategoryMutation.isPending}
                              onClick={() => saveCategoryMutation.mutate(cat)}
                            >
                              Save
                            </Button>
                            {!cat.id.startsWith('new-') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteCategoryMutation.mutate(cat.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <Input
                          placeholder="Service name"
                          value={cat.service}
                          onChange={(e) => updateCategory(index, { service: e.target.value })}
                        />
                        <Input
                          placeholder="Category title"
                          value={cat.category}
                          onChange={(e) => updateCategory(index, { category: e.target.value })}
                        />
                        <Input
                          placeholder="Seed keyword"
                          value={cat.seedKeyword}
                          onChange={(e) => updateCategory(index, { seedKeyword: e.target.value })}
                        />
                        <Textarea
                          placeholder="Keywords (comma-separated)"
                          value={cat.keywords.join(', ')}
                          onChange={(e) =>
                            updateCategory(index, {
                              keywords: e.target.value
                                .split(',')
                                .map((k) => k.trim())
                                .filter(Boolean),
                            })
                          }
                          className="min-h-[80px]"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={cat.active}
                            onChange={(e) => updateCategory(index, { active: e.target.checked })}
                          />
                          Active in rotation
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {section.id !== 'categories' && (
                  <div className="mt-5 flex justify-end">
                    <Button
                      onClick={() => saveConfigMutation.mutate(draftConfig)}
                      disabled={saveConfigMutation.isPending}
                    >
                      {saveConfigMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save {section.label}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
