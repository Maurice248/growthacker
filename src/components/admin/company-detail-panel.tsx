'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewAsCompanyButton } from '@/components/admin/view-as-company-button';
import { AdminUsersTable } from '@/components/admin/admin-users-table';

type CompanyDetail = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  integrationsConfigured: boolean;
  moduleStatuses: Array<{ id: string; label: string; configured: boolean }>;
  hasBrandConfig: boolean;
  brandConfigUpdatedAt: string | null;
  pendingInvites: Array<{ id: string; email: string; role: string; expiresAt: string }>;
};

export function CompanyDetailPanel({ companyId }: { companyId: string }) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load company');
      setCompany(data);
      setName(data.name);
      setSlug(data.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update company');
      setSuccess('Company updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update company');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this company and all related data? This cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete company');
      window.location.href = '/admin/companies';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete company');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading company...
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Company not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/companies" className="text-sm text-violet-600 hover:underline">
            ← Back to companies
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{company.name}</h1>
          <p className="mt-1 text-sm text-slate-500 font-mono">{company.slug}</p>
        </div>
        <ViewAsCompanyButton
          companyId={company.id}
          companyName={company.name}
          size="default"
          variant="default"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Company settings</CardTitle>
            <CardDescription>Update company name and slug.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Name</Label>
              <Input id="companyName" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companySlug">Slug</Label>
              <Input id="companySlug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete company'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status</CardTitle>
            <CardDescription>Integration and onboarding overview.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Integrations</span>
              <Badge variant={company.integrationsConfigured ? 'default' : 'outline'}>
                {company.integrationsConfigured ? 'Configured' : 'Not configured'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Onboarding</span>
              <Badge variant={company.onboardingCompletedAt ? 'secondary' : 'outline'}>
                {company.onboardingCompletedAt ? 'Complete' : 'Pending'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Brand config</span>
              <Badge variant={company.hasBrandConfig ? 'secondary' : 'outline'}>
                {company.hasBrandConfig ? 'Present' : 'Missing'}
              </Badge>
            </div>
            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Modules
              </p>
              <div className="flex flex-wrap gap-2">
                {company.moduleStatuses.map((m) => (
                  <Badge key={m.id} variant={m.configured ? 'default' : 'outline'}>
                    {m.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {company.pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending invites</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {company.pendingInvites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span>{inv.email}</span>
                  <Badge variant="outline">{inv.role}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Company members</h2>
        <AdminUsersTable companyFilter={companyId} showCompanyColumn={false} />
      </div>
    </div>
  );
}
