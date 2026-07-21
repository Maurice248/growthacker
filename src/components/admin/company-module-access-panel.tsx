'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ModuleSetting = {
  id: string;
  label: string;
  enabled: boolean;
};

type SettingsResponse = {
  maintenanceMessage: string;
  updatedAt: string;
  modules: ModuleSetting[];
};

export function CompanyModuleAccessPanel({
  companyId,
  onSaved,
}: {
  companyId: string;
  onSaved?: () => void;
}) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/modules`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load module access');
      setSettings(data);
      setMaintenanceMessage(data.maintenanceMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load module access');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleModule = (moduleId: string, enabled: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      modules: settings.modules.map((m) => (m.id === moduleId ? { ...m, enabled } : m)),
    });
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const modules = Object.fromEntries(settings.modules.map((m) => [m.id, m.enabled]));
      const res = await fetch(`/api/admin/companies/${companyId}/modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules, maintenanceMessage: maintenanceMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save module access');
      setSettings(data);
      setMaintenanceMessage(data.maintenanceMessage);
      setSuccess('Module access saved for this company.');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save module access');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading module access...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Failed to load module access.
      </div>
    );
  }

  const disabledCount = settings.modules.filter((m) => !m.enabled).length;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Product modules</p>
            <p className="text-xs text-slate-500">
              {disabledCount === 0
                ? 'All modules enabled for this company.'
                : `${disabledCount} module${disabledCount === 1 ? '' : 's'} hidden from this company.`}
            </p>
          </div>
          {settings.modules.map((module) => (
            <div
              key={module.id}
              className={cn(
                'flex items-center justify-between rounded-lg border px-4 py-3',
                module.enabled ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50/50'
              )}
            >
              <div className="flex items-center gap-3">
                {!module.enabled && <Wrench className="h-4 w-4 text-amber-600" />}
                <div>
                  <div className="font-medium text-slate-900">{module.label}</div>
                    <div className="text-xs text-slate-500">
                      {module.enabled ? 'Enabled' : 'Hidden from sidebar'}
                    </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={module.enabled ? 'default' : 'outline'}>
                  {module.enabled ? 'On' : 'Off'}
                </Badge>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={module.enabled}
                    onChange={(e) => toggleModule(module.id, e.target.checked)}
                    className="peer sr-only"
                    aria-label={`Toggle ${module.label}`}
                  />
                  <span className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400 peer-focus-visible:ring-offset-2 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`maintenanceMessage-${companyId}`}>Maintenance message</Label>
            <p className="text-xs text-slate-500">
              Optional message stored for this company (not shown while modules are hidden).
            </p>
            <Textarea
              id={`maintenanceMessage-${companyId}`}
              value={maintenanceMessage}
              onChange={(e) => {
                setMaintenanceMessage(e.target.value);
                setSuccess(null);
              }}
              rows={5}
              placeholder="This module is under maintenance. Please check back later."
            />
          </div>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save module access'}
          </Button>
          {settings.updatedAt && (
            <p className="text-xs text-slate-400">
              Last updated {new Date(settings.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
