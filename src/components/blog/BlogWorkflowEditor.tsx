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
  RefreshCw,
  Save,
  Sparkles,
  Workflow,
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
import type { BlogWorkflowConnectionInfo } from '@/lib/n8n-workflows';
import {
  buildSectionSavePayload,
  getSectionFieldValue,
  isSectionDirty,
  WORKFLOW_SETTINGS_NODE_ID,
  type BlogAutomationEditorField,
  type BlogAutomationEditorSection,
} from '@/lib/blog-automation-editor';
import { buildTimezoneSelectOptions, fromTimezoneSelectValue, toTimezoneSelectValue } from '@/lib/timezones';
import { cn } from '@/lib/utils';

interface WorkflowResponse {
  configured: boolean;
  workflowId?: string;
  workflowName?: string;
  webhookPath?: string | null;
  active?: boolean;
  updatedAt?: string;
  connection?: BlogWorkflowConnectionInfo;
  editorSections?: BlogAutomationEditorSection[];
  workflowTimezone?: string | null;
  error?: string;
}

function formatUpdatedAt(iso?: string): string {
  if (!iso) return 'Unknown';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

const SECTION_ICONS: Record<string, typeof Calendar> = {
  schedule: Calendar,
  'title-prompts': FileText,
  'article-prompts': Sparkles,
  'image-prompts': ImageIcon,
};

function formatPromptForDisplay(value: string): string {
  return value.startsWith('=') ? value.slice(1) : value;
}

function formatPromptForSave(original: string, edited: string): string {
  const trimmed = edited.trim();
  if (original.startsWith('=') && !trimmed.startsWith('=')) {
    return `=${trimmed}`;
  }
  return trimmed;
}

function isPromptField(key: string): boolean {
  return key === 'text' || key === 'systemMessage';
}

function ScheduleHourField({
  field,
  value,
  timezoneField,
  timezoneValue,
  currentWorkflowTimezone,
  onChange,
  onTimezoneChange,
}: {
  field: BlogAutomationEditorField;
  value: string;
  timezoneField: BlogAutomationEditorField;
  timezoneValue: string;
  currentWorkflowTimezone: string | null;
  onChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
}) {
  const timezoneOptions = useMemo(
    () => buildTimezoneSelectOptions(currentWorkflowTimezone),
    [currentWorkflowTimezone]
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-800">{field.label}</Label>
        {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
        <Input
          type="number"
          min={0}
          max={23}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[160px]"
        />
      </div>
      <div className="space-y-2 sm:flex-1">
        <Label className="text-sm font-medium text-gray-800">{timezoneField.label}</Label>
        {timezoneField.description && (
          <p className="text-xs text-gray-500">{timezoneField.description}</p>
        )}
        <Select
          value={toTimezoneSelectValue(timezoneValue)}
          onValueChange={(value) => onTimezoneChange(fromTimezoneSelectValue(value))}
        >
          <SelectTrigger className="max-w-full bg-white sm:max-w-[360px]">
            <SelectValue placeholder="Select timezone" />
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
    </div>
  );
}

function PromptField({
  field,
  value,
  onChange,
}: {
  field: BlogAutomationEditorField;
  value: string;
  onChange: (value: string) => void;
}) {
  const displayValue = isPromptField(field.key) ? formatPromptForDisplay(value) : value;

  if (field.key === 'triggerAtHour' || field.key === 'daysInterval' || field.key === 'runEveryDays') {
    return (
      <Input
        type="number"
        min={field.key === 'triggerAtHour' ? 0 : 1}
        max={field.key === 'triggerAtHour' ? 23 : 31}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[160px]"
      />
    );
  }

  return (
    <Textarea
      value={displayValue}
      onChange={(e) => {
        const next = isPromptField(field.key)
          ? formatPromptForSave(field.value, e.target.value)
          : e.target.value;
        onChange(next);
      }}
      className="min-h-[220px] text-sm leading-relaxed"
      spellCheck
    />
  );
}

export function BlogWorkflowEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openSectionId, setOpenSectionId] = useState<string>('schedule');
  const [draftFields, setDraftFields] = useState<Record<string, Record<string, string>>>({});

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['blog-workflow'],
    queryFn: async () => {
      const res = await fetch('/api/blog/workflow', { cache: 'no-store' });
      const text = await res.text();
      let json: WorkflowResponse;
      try {
        json = JSON.parse(text) as WorkflowResponse;
      } catch {
        throw new Error(
          text.trim().slice(0, 200) || `Server returned ${res.status} (not JSON)`
        );
      }
      if (!res.ok && json.error) throw new Error(json.error);
      return json;
    },
  });

  const sections = data?.editorSections ?? [];

  useEffect(() => {
    if (sections.length > 0 && !sections.some((s) => s.id === openSectionId)) {
      setOpenSectionId(sections[0]!.id);
    }
  }, [sections, openSectionId]);

  const dirtySectionCount = useMemo(
    () => sections.filter((section) => isSectionDirty(section, draftFields)).length,
    [sections, draftFields]
  );

  const setFieldValue = (nodeId: string, fieldKey: string, value: string) => {
    setDraftFields((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], [fieldKey]: value },
    }));
  };

  const resetSectionDraft = (section: BlogAutomationEditorSection) => {
    setDraftFields((prev) => {
      const next = { ...prev };
      for (const field of section.fields) {
        if (next[field.nodeId]) {
          const nodeDraft = { ...next[field.nodeId] };
          delete nodeDraft[field.key];
          if (Object.keys(nodeDraft).length === 0) delete next[field.nodeId];
          else next[field.nodeId] = nodeDraft;
        }
      }
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (section: BlogAutomationEditorSection) => {
      const { updates, settings } = buildSectionSavePayload(section, draftFields);
      const res = await fetch('/api/blog/workflow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates,
          ...(settings ? { settings } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save workflow');
      return { json, section };
    },
    onSuccess: ({ json, section }) => {
      queryClient.invalidateQueries({ queryKey: ['blog-workflow'] });
      resetSectionDraft(section);
      toast({
        title: json.activationError
          ? json.republished
            ? 'Saved (update webhook URL)'
            : 'Saved (activation failed)'
          : json.republished
            ? 'Saved & published'
            : 'Saved',
        description: json.message ?? `${section.title} updated in n8n.`,
        variant: json.activationError ? 'destructive' : 'default',
      });
    },
    onError: (err) => {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Could not update workflow',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Could not load workflow settings</p>
          <p className="mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">n8n API not configured</p>
          <p className="mt-1 text-amber-800">
            Add <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">N8N_API_KEY</code> to your{' '}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">.env</code> file to edit schedule and
            prompts.
          </p>
        </div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Could not find the expected workflow nodes (Schedule Trigger, Title Generator, Article Chain, Image Agent).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.connection && (
        <div className="rounded-xl border border-[#0077b6]/20 bg-[#0077b6]/5 px-4 py-4">
          <p className="text-sm font-semibold text-[#0077b6]">Connected n8n workflow</p>
          <p className="mt-1 text-sm text-gray-800">
            <span className="font-medium">{data.connection.resolvedWorkflowName}</span>
            <span className="text-gray-500"> · ID </span>
            <code className="rounded bg-white px-1.5 py-0.5 text-xs text-gray-700">
              {data.connection.resolvedWorkflowId}
            </code>
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Webhook{' '}
            <code className="rounded bg-white px-1 py-0.5">/{data.connection.webhookPath ?? 'blog-automation'}</code>
            {' · '}
            {data.connection.resolvedWorkflowActive ? 'Active' : 'Inactive'}
            {' · '}
            Updated {formatUpdatedAt(data.connection.resolvedWorkflowUpdatedAt)}
          </p>
          <p className="mt-2 text-xs text-gray-600">
            Settings use this workflow — the one that owns your{' '}
            <code className="rounded bg-white px-1 py-0.5">N8N_BLOG_AUTOMATION_WEBHOOK_URL</code> path in n8n.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Workflow className="h-3 w-3" />
            {data.workflowName ?? 'Blog workflow'}
          </Badge>
          {data.webhookPath && (
            <Badge variant="outline" className="font-mono text-xs">
              /{data.webhookPath}
            </Badge>
          )}
          <Badge variant={data.active ? 'success' : 'warning'}>
            {data.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      <p className="text-sm text-gray-500">
        Edit schedule and AI prompts below. Changes are saved directly to your live n8n workflow.
        {dirtySectionCount > 0 && (
          <span className="ml-1 font-medium text-amber-700">
            {dirtySectionCount} unsaved section{dirtySectionCount === 1 ? '' : 's'}.
          </span>
        )}
      </p>

      <div className="space-y-3">
        {sections.map((section) => {
          const Icon = SECTION_ICONS[section.id] ?? FileText;
          const open = openSectionId === section.id;
          const dirty = isSectionDirty(section, draftFields);
          const saving = saveMutation.isPending && saveMutation.variables?.id === section.id;

          return (
            <div
              key={section.id}
              className={cn(
                'overflow-hidden rounded-xl border bg-white transition-shadow',
                open ? 'border-[#0077b6]/30 shadow-sm' : 'border-gray-200',
                dirty && !open && 'border-amber-300'
              )}
            >
              <button
                type="button"
                className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-gray-50/80"
                onClick={() => setOpenSectionId(open ? '' : section.id)}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    open ? 'bg-[#0077b6]/10 text-[#0077b6]' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{section.title}</h2>
                    {dirty && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        Unsaved
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">{section.description}</p>
                </div>
                <ChevronDown
                  className={cn(
                    'mt-1 h-5 w-5 shrink-0 text-gray-400 transition-transform',
                    open && 'rotate-180'
                  )}
                />
              </button>

              {open && (
                <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                  <div className="space-y-5">
                    {section.id === 'schedule' ? (
                      <>
                        {(() => {
                          const hourField = section.fields.find((field) => field.key === 'triggerAtHour');
                          const timezoneField = section.fields.find((field) => field.key === 'timezone');
                          const otherFields = section.fields.filter(
                            (field) => field.key !== 'triggerAtHour' && field.key !== 'timezone'
                          );

                          return (
                            <>
                              {hourField && timezoneField && (
                                <ScheduleHourField
                                  field={hourField}
                                  value={getSectionFieldValue(hourField, draftFields)}
                                  timezoneField={timezoneField}
                                  timezoneValue={getSectionFieldValue(timezoneField, draftFields)}
                                  currentWorkflowTimezone={data?.workflowTimezone ?? null}
                                  onChange={(value) =>
                                    setFieldValue(hourField.nodeId, hourField.key, value)
                                  }
                                  onTimezoneChange={(value) =>
                                    setFieldValue(WORKFLOW_SETTINGS_NODE_ID, 'timezone', value)
                                  }
                                />
                              )}
                              {otherFields.map((field) => (
                                <div key={`${field.nodeId}-${field.key}`} className="space-y-2">
                                  <Label className="text-sm font-medium text-gray-800">{field.label}</Label>
                                  {field.description && (
                                    <p className="text-xs text-gray-500">{field.description}</p>
                                  )}
                                  <PromptField
                                    field={field}
                                    value={getSectionFieldValue(field, draftFields)}
                                    onChange={(value) => setFieldValue(field.nodeId, field.key, value)}
                                  />
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      section.fields.map((field) => (
                        <div key={`${field.nodeId}-${field.key}`} className="space-y-2">
                          <Label className="text-sm font-medium text-gray-800">{field.label}</Label>
                          {field.description && (
                            <p className="text-xs text-gray-500">{field.description}</p>
                          )}
                          <PromptField
                            field={field}
                            value={getSectionFieldValue(field, draftFields)}
                            onChange={(value) => setFieldValue(field.nodeId, field.key, value)}
                          />
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4">
                    {dirty && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => resetSectionDraft(section)}
                      >
                        Discard
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#0077b6] text-white hover:bg-[#005f8f]"
                      disabled={!dirty || saving}
                      onClick={() => saveMutation.mutate(section)}
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-3.5 w-3.5" />
                      )}
                      Save {section.title}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
