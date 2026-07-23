'use client';

import { useEffect, useState } from 'react';
import { useAppSection } from '@/lib/app-section';
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
  EditorialPillButton,
  EditorialSectionHeader,
  OutreachActionLink,
  OutreachMetricInput,
} from '@/components/cold-email/outreach-ui';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Header } from '@/components/dashboard/header';
import { PageBody } from '@/components/outreach/page-body';

type ConfigForm = {
  instantlyCampaignId: string;
  senderName: string;
  defaultCtaLink: string;
  cleanupIntervalDays: number;
  cleanupBatchSize: number;
  dailySendLimit: number;
  active: boolean;
};

type LeadList = {
  id: string;
  name: string;
  description: string;
  _count?: { leads: number };
};

const EMPTY: ConfigForm = {
  instantlyCampaignId: '',
  senderName: '',
  defaultCtaLink: '',
  cleanupIntervalDays: 10,
  cleanupBatchSize: 100,
  dailySendLimit: 60,
  active: true,
};

export default function ColdEmailSettings() {
  const { toast } = useToast();
  const { section } = useAppSection();
  const isOutreach = section === 'outreach';
  const [form, setForm] = useState<ConfigForm>(EMPTY);
  const [companyName, setCompanyName] = useState('');
  const [lists, setLists] = useState<LeadList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [saving, setSaving] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const [configRes, listsRes] = await Promise.all([
      fetch('/api/cold-email/config'),
      fetch('/api/cold-email/lists'),
    ]);
    const configJson = await configRes.json();
    const listsJson = await listsRes.json();

    if (configJson.context) {
      setCompanyName(configJson.context.companyName || '');
    }
    const cfg = configJson.config || {};
    setForm({
      instantlyCampaignId: cfg.instantlyCampaignId ?? configJson.context?.instantlyCampaignId ?? '',
      senderName: cfg.senderName ?? configJson.context?.senderName ?? '',
      defaultCtaLink: cfg.defaultCtaLink ?? configJson.context?.defaultCtaLink ?? '',
      cleanupIntervalDays: cfg.cleanupIntervalDays ?? 10,
      cleanupBatchSize: cfg.cleanupBatchSize ?? 100,
      dailySendLimit: cfg.dailySendLimit ?? configJson.context?.dailySendLimit ?? 60,
      active: cfg.active ?? true,
    });
    setLists(listsJson.lists || []);
  }

  useEffect(() => {
    loadData()
      .catch(() => toast({ title: 'Failed to load settings', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const update = (key: keyof ConfigForm, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/cold-email/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast({ title: 'Settings saved' });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      const res = await fetch('/api/cold-email/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create list');
      setNewListName('');
      await loadData();
      toast({ title: `List "${json.list.name}" created` });
    } catch (err) {
      toast({
        title: 'Failed to create list',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setCreatingList(false);
    }
  };

  const handleDeleteList = async (id: string, name: string) => {
    if (!confirm(`Delete list "${name}" and all its leads?`)) return;
    try {
      const res = await fetch(`/api/cold-email/lists/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await loadData();
      toast({ title: 'List deleted' });
    } catch {
      toast({ title: 'Failed to delete list', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="Cold Email Settings" description="Loading..." />
        <PageBody className="py-16 text-center text-[var(--text-muted)]">Loading settings...</PageBody>
      </div>
    );
  }

  const description = isOutreach
    ? 'Configure Instantly.ai and lead lists. When you approve a campaign, verified leads are pushed to Instantly, which handles deliverability, follow-ups, and inbox rotation.'
    : `Configure Instantly.ai and lead lists for ${companyName}. AI prompts use Brand Context automatically.`;

  return (
    <div>
      <Header title="Cold Email Settings" description={description} />

      <PageBody className={isOutreach ? undefined : 'max-w-2xl mx-auto space-y-6'}>
        {isOutreach ? (
          <>
            <section>
              <EditorialSectionHeader title="Instantly & Sending" />
              <EditorialDefinitionList>
                <EditorialDefinitionRow
                  label="Instantly campaign ID"
                  labelSub="UUID from your Instantly dashboard"
                >
                  <EditorialField
                    value={form.instantlyCampaignId}
                    onChange={(v) => update('instantlyCampaignId', v)}
                  />
                </EditorialDefinitionRow>
                <EditorialDefinitionRow label="Sender & CTA">
                  <div className="flex flex-wrap gap-8">
                    <EditorialField
                      value={form.senderName}
                      onChange={(v) => update('senderName', v)}
                    />
                    <EditorialField
                      value={form.defaultCtaLink}
                      onChange={(v) => update('defaultCtaLink', v)}
                    />
                  </div>
                </EditorialDefinitionRow>
                <EditorialDefinitionRow label="Limits" isLast>
                  <div className="flex flex-wrap gap-12">
                    <div>
                      <div className="mb-1.5 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Daily send limit
                      </div>
                      <OutreachMetricInput
                        value={String(form.dailySendLimit)}
                        onChange={(v) => update('dailySendLimit', Number(v) || 60)}
                        min={1}
                        width="md"
                      />
                    </div>
                    <div>
                      <div className="mb-1.5 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Cleanup batch
                      </div>
                      <OutreachMetricInput
                        value={String(form.cleanupBatchSize)}
                        onChange={(v) => update('cleanupBatchSize', Number(v) || 100)}
                        min={1}
                        width="md"
                      />
                    </div>
                    <div>
                      <div className="mb-1.5 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Interval (days)
                      </div>
                      <OutreachMetricInput
                        value={String(form.cleanupIntervalDays)}
                        onChange={(v) => update('cleanupIntervalDays', Number(v) || 10)}
                        min={1}
                        width="md"
                      />
                    </div>
                  </div>
                </EditorialDefinitionRow>
              </EditorialDefinitionList>
              <div className="flex flex-wrap items-baseline gap-4 pt-4">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => update('active', e.target.checked)}
                    className="h-[15px] w-[15px] accent-[var(--red)]"
                  />
                  Enable scheduled Instantly cleanup
                </label>
                <EditorialPillButton
                  variant="danger"
                  disabled={saving}
                  onClick={handleSave}
                  style={{ marginLeft: 'auto', padding: '10px 24px', whiteSpace: 'nowrap' }}
                >
                  {saving ? 'Saving…' : 'Save settings'}
                </EditorialPillButton>
              </div>
            </section>

            <section>
              <EditorialSectionHeader
                title="Lead Lists"
                meta="Scraper and campaigns target these lists"
              />
              <div className="flex items-baseline gap-4 border-b border-[var(--border)] py-4">
                <EditorialField
                  value={newListName}
                  onChange={setNewListName}
                  placeholder="New list name, e.g. Property Managers"
                />
                <OutreachActionLink disabled={creatingList || !newListName.trim()} onClick={handleCreateList}>
                  + Add
                </OutreachActionLink>
              </div>
              {lists.length === 0 ? (
                <p className="py-4 text-sm text-[var(--text-muted)]">No lead lists yet.</p>
              ) : (
                lists.map((list) => (
                  <div
                    key={list.id}
                    className="flex items-baseline justify-between gap-5 border-b border-[var(--border)] py-4"
                  >
                    <div>
                      <span className="text-[15px] font-bold text-[var(--primary)]">{list.name}</span>
                      <span className="ml-2 text-[13px] text-[var(--text-muted)]">
                        {list._count?.leads ?? 0} leads
                      </span>
                    </div>
                    <OutreachActionLink variant="muted" onClick={() => handleDeleteList(list.id, list.name)}>
                      Remove
                    </OutreachActionLink>
                  </div>
                ))
              )}
            </section>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <strong>How sending works:</strong> When you approve a campaign, verified leads are pushed to your{' '}
              <strong>Instantly.ai</strong> campaign. Instantly handles deliverability, follow-ups, and inbox rotation.
              Add your Instantly API key in API Keys.
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Instantly &amp; Sending</CardTitle>
                <CardDescription>Per-company Instantly campaign and send limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <LegacyField
                  label="Instantly Campaign ID"
                  value={form.instantlyCampaignId}
                  onChange={(v) => update('instantlyCampaignId', v)}
                  hint="UUID from your Instantly.ai campaign dashboard"
                />
                <LegacyField
                  label="Sender Name"
                  value={form.senderName}
                  onChange={(v) => update('senderName', v)}
                  hint="Used in email personalization"
                />
                <LegacyField
                  label="Default CTA Link"
                  value={form.defaultCtaLink}
                  onChange={(v) => update('defaultCtaLink', v)}
                  hint="Fallback destination URL when campaigns omit cta_link"
                />
                <div className="grid grid-cols-3 gap-4">
                  <LegacyField
                    label="Daily Send Limit"
                    value={String(form.dailySendLimit)}
                    onChange={(v) => update('dailySendLimit', Number(v) || 60)}
                    type="number"
                  />
                  <LegacyField
                    label="Cleanup Batch Size"
                    value={String(form.cleanupBatchSize)}
                    onChange={(v) => update('cleanupBatchSize', Number(v) || 100)}
                    type="number"
                  />
                  <LegacyField
                    label="Cleanup Interval (days)"
                    value={String(form.cleanupIntervalDays)}
                    onChange={(v) => update('cleanupIntervalDays', Number(v) || 10)}
                    type="number"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => update('active', e.target.checked)}
                  />
                  Enable scheduled Instantly cleanup
                </label>
                <Button onClick={handleSave} disabled={saving} className="w-full bg-[#003049] hover:bg-[#1A4A66]">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lead Lists</CardTitle>
                <CardDescription>
                  Company-specific lists replace the old fixed Google Sheet tabs. Scraper and campaigns target these lists.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="New list name, e.g. Property Managers"
                  />
                  <Button onClick={handleCreateList} disabled={creatingList || !newListName.trim()}>
                    Add
                  </Button>
                </div>

                {lists.length === 0 ? (
                  <p className="text-sm text-gray-500">No lead lists yet. Create one to start scraping.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-lg border">
                    {lists.map((list) => (
                      <li key={list.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{list.name}</p>
                          <p className="text-xs text-gray-500">{list._count?.leads ?? 0} leads</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteList(list.id, list.name)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </PageBody>
    </div>
  );
}

function LegacyField({
  label,
  value,
  onChange,
  hint,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
