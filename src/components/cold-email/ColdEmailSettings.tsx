'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
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
        <PageBody className="max-w-2xl mx-auto py-16 text-center text-gray-500">Loading settings...</PageBody>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Cold Email Settings"
        description={`Configure Instantly.ai and lead lists for ${companyName}. AI prompts use Brand Context automatically.`}
      />

      <PageBody className="max-w-2xl mx-auto space-y-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <strong>How sending works:</strong> When you approve a campaign, verified leads are pushed to your{' '}
          <strong>Instantly.ai</strong> campaign. Instantly handles deliverability, follow-ups, and inbox rotation.
          Add your Instantly API key in API key management.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instantly &amp; Sending</CardTitle>
            <CardDescription>Per-company Instantly campaign and send limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Instantly Campaign ID"
              value={form.instantlyCampaignId}
              onChange={(v) => update('instantlyCampaignId', v)}
              hint="UUID from your Instantly.ai campaign dashboard"
            />
            <Field
              label="Sender Name"
              value={form.senderName}
              onChange={(v) => update('senderName', v)}
              hint="Used in email personalization"
            />
            <Field
              label="Default CTA Link"
              value={form.defaultCtaLink}
              onChange={(v) => update('defaultCtaLink', v)}
              hint="Fallback destination URL when campaigns omit cta_link"
            />
            <div className="grid grid-cols-3 gap-4">
              <Field
                label="Daily Send Limit"
                value={String(form.dailySendLimit)}
                onChange={(v) => update('dailySendLimit', Number(v) || 60)}
                type="number"
              />
              <Field
                label="Cleanup Batch Size"
                value={String(form.cleanupBatchSize)}
                onChange={(v) => update('cleanupBatchSize', Number(v) || 100)}
                type="number"
              />
              <Field
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
            <Button onClick={handleSave} disabled={saving} className="w-full bg-[#0077b6] hover:bg-[#005f8f]">
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
                <Plus className="mr-1 h-4 w-4" />
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
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </div>
  );
}

function Field({
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
