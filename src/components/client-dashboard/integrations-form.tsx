'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SecretField = { set: boolean; masked: string };

type ApiTokenSecretView = {
  key: string;
  label: string;
  placeholder: string;
  set: boolean;
  masked: string;
};

type DataForSeoCredentialView = {
  loginSet: boolean;
  loginMasked: string;
  passwordSet: boolean;
  passwordMasked: string;
  configured: boolean;
};

type IntegrationSettings = {
  metaAccessToken: SecretField;
  metaAdAccountId: string;
  metaPageId: string;
  wordpressSiteUrl: string;
  wordpressUsername: string;
  wordpressAppPassword: SecretField;
};

const emptyForm = {
  metaAccessToken: '',
  metaAdAccountId: '',
  metaPageId: '',
  wordpressSiteUrl: '',
  wordpressUsername: '',
  wordpressAppPassword: '',
};

function SecretHint({ field }: { field: SecretField }) {
  if (!field.set) {
    return <p className="text-xs text-[var(--text-muted)]">Not configured</p>;
  }
  return (
    <p className="text-xs text-[var(--text-muted)]">
      Saved: <span className="font-mono">{field.masked}</span> — leave blank to keep current value
    </p>
  );
}

export function IntegrationsForm({ readOnly = false }: { readOnly?: boolean }) {
  const router = useRouter();
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [apiTokenSecrets, setApiTokenSecrets] = useState<ApiTokenSecretView[]>([]);
  const [apiTokenForm, setApiTokenForm] = useState<Record<string, string>>({});
  const [dataforseoView, setDataforseoView] = useState<DataForSeoCredentialView | null>(null);
  const [dataforseoForm, setDataforseoForm] = useState({ login: '', password: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/companies/integrations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load integrations');

      const tokenRes = await fetch('/api/tokens/secret');
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error || 'Failed to load API tokens');

      setSettings(data);
      setApiTokenSecrets(tokenData.tokens ?? []);
      setDataforseoView(tokenData.dataforseo ?? null);
      setApiTokenForm(Object.fromEntries((tokenData.tokens ?? []).map((t: ApiTokenSecretView) => [t.key, ''])));
      setDataforseoForm({ login: '', password: '' });
      setForm({
        metaAccessToken: '',
        metaAdAccountId: data.metaAdAccountId || '',
        metaPageId: data.metaPageId || '',
        wordpressSiteUrl: data.wordpressSiteUrl || '',
        wordpressUsername: data.wordpressUsername || '',
        wordpressAppPassword: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      metaAdAccountId: form.metaAdAccountId,
      metaPageId: form.metaPageId,
      wordpressSiteUrl: form.wordpressSiteUrl,
      wordpressUsername: form.wordpressUsername,
    };

    if (form.metaAccessToken.trim()) payload.metaAccessToken = form.metaAccessToken.trim();
    if (form.wordpressAppPassword.trim()) {
      payload.wordpressAppPassword = form.wordpressAppPassword.trim();
    }

    const tokenPayload: Record<string, string> = {};
    for (const token of apiTokenSecrets) {
      const value = apiTokenForm[token.key]?.trim();
      if (value) tokenPayload[token.key] = value;
    }
    if (dataforseoForm.login.trim()) tokenPayload.dataforseoLogin = dataforseoForm.login.trim();
    if (dataforseoForm.password.trim()) {
      tokenPayload.dataforseoPassword = dataforseoForm.password.trim();
    }

    try {
      const res = await fetch('/api/companies/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save integrations');

      const tokenRes = await fetch('/api/tokens/secret', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenPayload),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error || 'Failed to save API tokens');

      setSettings(data);
      setApiTokenSecrets(tokenData.tokens ?? []);
      setDataforseoView(tokenData.dataforseo ?? null);
      setApiTokenForm(Object.fromEntries((tokenData.tokens ?? []).map((t: ApiTokenSecretView) => [t.key, ''])));
      setDataforseoForm({ login: '', password: '' });
      setForm((prev) => ({
        ...prev,
        metaAccessToken: '',
        wordpressAppPassword: '',
      }));
      setSuccess('Integration settings saved.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save integrations');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading integrations…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {readOnly && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-muted)]">
          Only company admins can edit integration settings.
        </div>
      )}

      <fieldset disabled={readOnly} className="space-y-6 disabled:opacity-80">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5" />
            Meta Ads
          </CardTitle>
          <CardDescription>
            Credentials for launching campaigns, live ads, reports, and location search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaAccessToken">Access token</Label>
            <Input
              id="metaAccessToken"
              type="password"
              autoComplete="off"
              placeholder={settings?.metaAccessToken.set ? '••••••••' : 'EAAG…'}
              value={form.metaAccessToken}
              onChange={(e) => setForm((f) => ({ ...f, metaAccessToken: e.target.value }))}
            />
            {settings && <SecretHint field={settings.metaAccessToken} />}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="metaAdAccountId">Ad account ID</Label>
              <Input
                id="metaAdAccountId"
                placeholder="10152738476174098"
                value={form.metaAdAccountId}
                onChange={(e) => setForm((f) => ({ ...f, metaAdAccountId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaPageId">Facebook page ID</Label>
              <Input
                id="metaPageId"
                placeholder="750158511525291"
                value={form.metaPageId}
                onChange={(e) => setForm((f) => ({ ...f, metaPageId: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">WordPress</CardTitle>
          <CardDescription>Blog publishing credentials for your WordPress site.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wordpressSiteUrl">Site URL</Label>
            <Input
              id="wordpressSiteUrl"
              type="url"
              placeholder="https://blog.example.com"
              value={form.wordpressSiteUrl}
              onChange={(e) => setForm((f) => ({ ...f, wordpressSiteUrl: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wordpressUsername">Username</Label>
              <Input
                id="wordpressUsername"
                autoComplete="off"
                value={form.wordpressUsername}
                onChange={(e) => setForm((f) => ({ ...f, wordpressUsername: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wordpressAppPassword">Application password</Label>
              <Input
                id="wordpressAppPassword"
                type="password"
                autoComplete="new-password"
                placeholder={settings?.wordpressAppPassword.set ? '••••••••' : ''}
                value={form.wordpressAppPassword}
                onChange={(e) => setForm((f) => ({ ...f, wordpressAppPassword: e.target.value }))}
              />
              {settings && <SecretHint field={settings.wordpressAppPassword} />}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">DataForSEO</CardTitle>
          <CardDescription>
            Blog keyword research credentials. Use your DataForSEO account login and API password from{' '}
            <a
              href="https://app.dataforseo.com/api-access"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] underline"
            >
              app.dataforseo.com/api-access
            </a>
            . Leave a field blank to keep the current saved value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dataforseoLogin">Account login (email)</Label>
              <Input
                id="dataforseoLogin"
                type="email"
                autoComplete="off"
                placeholder={dataforseoView?.loginSet ? dataforseoView.loginMasked : 'you@company.com'}
                value={dataforseoForm.login}
                onChange={(e) =>
                  setDataforseoForm((prev) => ({ ...prev, login: e.target.value }))
                }
              />
              {dataforseoView?.loginSet ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Saved: <span className="font-mono">{dataforseoView.loginMasked}</span>
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Not configured</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataforseoPassword">API password</Label>
              <Input
                id="dataforseoPassword"
                type="password"
                autoComplete="new-password"
                placeholder={dataforseoView?.passwordSet ? '••••••••' : 'API password from DataForSEO dashboard'}
                value={dataforseoForm.password}
                onChange={(e) =>
                  setDataforseoForm((prev) => ({ ...prev, password: e.target.value }))
                }
              />
              {dataforseoView?.passwordSet ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Saved: <span className="font-mono">{dataforseoView.passwordMasked}</span>
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Not configured</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API tokens</CardTitle>
          <CardDescription>
            Third-party API keys used by native pipelines (Cold Email, Ads Analysis, Newsletter, Social Studio, Blog, Create Ad voiceovers). DataForSEO is configured in its own section above.
            Leave blank to keep the current saved value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiTokenSecrets.map((token) => (
            <div key={token.key} className="space-y-2">
              <Label htmlFor={`token-${token.key}`}>{token.label}</Label>
              <Input
                id={`token-${token.key}`}
                type="password"
                autoComplete="off"
                placeholder={token.set ? '••••••••' : token.placeholder}
                value={apiTokenForm[token.key] ?? ''}
                onChange={(e) =>
                  setApiTokenForm((prev) => ({ ...prev, [token.key]: e.target.value }))
                }
              />
              {token.set ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Saved: <span className="font-mono">{token.masked}</span> — leave blank to keep
                  current value
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Not configured</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {!readOnly && (
        <Button type="submit" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save integrations'}
        </Button>
      )}
      </fieldset>
    </form>
  );
}
