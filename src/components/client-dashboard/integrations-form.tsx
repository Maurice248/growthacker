'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
} from '@/app/components';
import { EditorialSectionHeader, editorialPillButtonClass } from '@/components/editorial/editorial-layout';
import { AiModuleSettings } from '@/components/client-dashboard/ai-module-settings';
import {
  defaultAiModuleRouting,
  defaultGatewayConnectionSettings,
  parseAiModuleRouting,
  parseGatewayConnection,
  type AiGatewayConnectionSettings,
  type AiGatewayKeyField,
  type AiModuleId,
  type AiModuleRoute,
  type AiModuleRoutingMap,
} from '@/lib/ai-module-routing';
import {
  APIFY_META_ADS_ACTORS,
  type ApifyMetaAdsActorId,
} from '@/lib/competitor-analysis/apify-actors';

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

type ApifyIntegrationView = {
  set: boolean;
  masked: string;
  placeholder: string;
  competitorApifyActor: ApifyMetaAdsActorId;
  adsLibraryApifyActor: ApifyMetaAdsActorId;
};

type IntegrationSettings = {
  metaAccessToken: SecretField;
  metaAdAccountId: string;
  metaPageId: string;
  wordpressSiteUrl: string;
  wordpressUsername: string;
  wordpressAppPassword: SecretField;
};

type GatewaySecretView = { key: AiGatewayKeyField; set: boolean; masked: string };

type GatewaySecretMap = Record<AiGatewayKeyField, GatewaySecretView>;

const GATEWAY_KEYS: AiGatewayKeyField[] = ['openrouter', 'vercelAiGateway'];

function emptyGatewaySecrets(): GatewaySecretMap {
  return {
    openrouter: { key: 'openrouter', set: false, masked: '' },
    vercelAiGateway: { key: 'vercelAiGateway', set: false, masked: '' },
  };
}

function toGatewaySecretMap(list: GatewaySecretView[] | undefined): GatewaySecretMap {
  const map = emptyGatewaySecrets();
  for (const item of list ?? []) {
    if (GATEWAY_KEYS.includes(item.key)) map[item.key] = item;
  }
  return map;
}

const emptyGatewayForm: Record<AiGatewayKeyField, string> = {
  openrouter: '',
  vercelAiGateway: '',
};

const emptyForm = {
  metaAccessToken: '',
  metaAdAccountId: '',
  metaPageId: '',
  wordpressSiteUrl: '',
  wordpressUsername: '',
  wordpressAppPassword: '',
};

export function IntegrationsForm({ readOnly = false }: { readOnly?: boolean }) {
  const router = useRouter();
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [apiTokenSecrets, setApiTokenSecrets] = useState<ApiTokenSecretView[]>([]);
  const [apiTokenForm, setApiTokenForm] = useState<Record<string, string>>({});
  const [apifyView, setApifyView] = useState<ApifyIntegrationView | null>(null);
  const [apifyForm, setApifyForm] = useState({
    apiKey: '',
    actor: 'curious_coder' as ApifyMetaAdsActorId,
    adsLibraryActor: 'curious_coder' as ApifyMetaAdsActorId,
  });
  const [dataforseoView, setDataforseoView] = useState<DataForSeoCredentialView | null>(null);
  const [dataforseoForm, setDataforseoForm] = useState({ login: '', password: '' });
  const [aiGateways, setAiGateways] = useState<GatewaySecretMap>(() => emptyGatewaySecrets());
  const [aiGatewayForm, setAiGatewayForm] =
    useState<Record<AiGatewayKeyField, string>>(emptyGatewayForm);
  const [aiConnection, setAiConnection] = useState<AiGatewayConnectionSettings>(() =>
    defaultGatewayConnectionSettings()
  );
  const [aiRoutes, setAiRoutes] = useState<AiModuleRoutingMap>(() => defaultAiModuleRouting());
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

      const aiRes = await fetch('/api/ai-routing');
      const aiData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiData.error || 'Failed to load AI routing');

      setAiRoutes(parseAiModuleRouting(aiData.routes));
      setAiConnection(parseGatewayConnection(aiData.connection));
      setAiGateways(toGatewaySecretMap(aiData.gateways));
      setAiGatewayForm(emptyGatewayForm);

      setSettings(data);
      setApiTokenSecrets(tokenData.tokens ?? []);
      setApifyView(tokenData.apify ?? null);
      setApifyForm({
        apiKey: '',
        actor: tokenData.apify?.competitorApifyActor ?? 'curious_coder',
        adsLibraryActor: tokenData.apify?.adsLibraryApifyActor ?? tokenData.apify?.competitorApifyActor ?? 'curious_coder',
      });
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

  const handleAiRouteChange = (moduleId: AiModuleId, patch: Partial<AiModuleRoute>) => {
    setAiRoutes((prev) => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], ...patch },
    }));
  };

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
    if (apifyForm.apiKey.trim()) tokenPayload.apify = apifyForm.apiKey.trim();
    tokenPayload.competitorApifyActor = apifyForm.actor;
    tokenPayload.adsLibraryApifyActor = apifyForm.adsLibraryActor;

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

      const gatewayKeys: Partial<Record<AiGatewayKeyField, string>> = {};
      for (const key of GATEWAY_KEYS) {
        const value = aiGatewayForm[key]?.trim();
        if (value) gatewayKeys[key] = value;
      }

      const aiRes = await fetch('/api/ai-routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routes: aiRoutes,
          connection: aiConnection,
          gatewayKeys,
        }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiData.error || 'Failed to save AI routing');

      setAiRoutes(parseAiModuleRouting(aiData.routes));
      setAiConnection(parseGatewayConnection(aiData.connection));
      setAiGateways(toGatewaySecretMap(aiData.gateways));
      setAiGatewayForm(emptyGatewayForm);

      setSettings(data);
      setApiTokenSecrets(tokenData.tokens ?? []);
      setApifyView(tokenData.apify ?? null);
      setApifyForm((prev) => ({
        apiKey: '',
        actor: tokenData.apify?.competitorApifyActor ?? prev.actor,
        adsLibraryActor: tokenData.apify?.adsLibraryApifyActor ?? prev.adsLibraryActor,
      }));
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

  const dataforseoSavedHint =
    dataforseoView?.loginSet || dataforseoView?.passwordSet
      ? `Saved: ${dataforseoView.loginSet ? dataforseoView.loginMasked : '—'} · ${dataforseoView.passwordSet ? dataforseoView.passwordMasked : '—'}`
      : undefined;

  return (
    <form onSubmit={handleSubmit}>
      {readOnly && (
        <div className="mb-4 text-sm text-[var(--text-muted)]">
          Only company admins can edit integration settings.
        </div>
      )}

      <fieldset disabled={readOnly} className="disabled:opacity-80">
        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-[var(--red)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 text-sm text-[#38678A]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        <section>
          <EditorialSectionHeader
            title="Meta Ads"
            meta="Campaigns, live ads, reports, location search"
          />
          <EditorialDefinitionList>
            <EditorialDefinitionRow
              label="Access token"
              labelSub={
                settings?.metaAccessToken.set
                  ? `Saved: ${settings.metaAccessToken.masked}`
                  : 'Not configured'
              }
            >
              <EditorialField
                value={form.metaAccessToken}
                onChange={(v) => setForm((f) => ({ ...f, metaAccessToken: v }))}
                type="password"
                placeholder="Leave blank to keep current value"
                style={{ maxWidth: 420 }}
              />
            </EditorialDefinitionRow>
            <EditorialDefinitionRow label="Account IDs" isLast>
              <div className="flex flex-wrap gap-8">
                <EditorialField
                  value={form.metaAdAccountId}
                  onChange={(v) => setForm((f) => ({ ...f, metaAdAccountId: v }))}
                  placeholder="Ad account ID"
                  style={{ flex: 1, minWidth: 180 }}
                />
                <EditorialField
                  value={form.metaPageId}
                  onChange={(v) => setForm((f) => ({ ...f, metaPageId: v }))}
                  placeholder="Facebook page ID"
                  style={{ flex: 1, minWidth: 180 }}
                />
              </div>
            </EditorialDefinitionRow>
          </EditorialDefinitionList>
        </section>

        <section className="mt-12">
          <EditorialSectionHeader title="WordPress" meta="Blog publishing credentials" />
          <EditorialDefinitionList>
            <EditorialDefinitionRow
              label="Site & login"
              labelSub={
                settings?.wordpressAppPassword.set
                  ? `Password saved: ${settings.wordpressAppPassword.masked}`
                  : 'Password not configured'
              }
              isLast
            >
              <div className="flex flex-wrap gap-8">
                <EditorialField
                  value={form.wordpressSiteUrl}
                  onChange={(v) => setForm((f) => ({ ...f, wordpressSiteUrl: v }))}
                  type="url"
                  placeholder="https://blog.example.com"
                  style={{ flex: 1.4, minWidth: 200 }}
                />
                <EditorialField
                  value={form.wordpressUsername}
                  onChange={(v) => setForm((f) => ({ ...f, wordpressUsername: v }))}
                  placeholder="Username"
                  style={{ flex: 1, minWidth: 140 }}
                />
                <EditorialField
                  value={form.wordpressAppPassword}
                  onChange={(v) => setForm((f) => ({ ...f, wordpressAppPassword: v }))}
                  type="password"
                  placeholder="Application password"
                  style={{ flex: 1, minWidth: 160 }}
                />
              </div>
            </EditorialDefinitionRow>
          </EditorialDefinitionList>
        </section>

        <section className="mt-10">
          <EditorialSectionHeader title="DataForSEO" meta="Blog keyword research credentials" />
          <EditorialDefinitionList>
            <EditorialDefinitionRow label="Login & password" labelSub={dataforseoSavedHint} isLast>
              <div className="flex flex-wrap gap-8">
                <EditorialField
                  value={dataforseoForm.login}
                  onChange={(v) => setDataforseoForm((prev) => ({ ...prev, login: v }))}
                  type="email"
                  placeholder="Account login (email)"
                  style={{ flex: 1.2, minWidth: 200 }}
                />
                <EditorialField
                  value={dataforseoForm.password}
                  onChange={(v) => setDataforseoForm((prev) => ({ ...prev, password: v }))}
                  type="password"
                  placeholder="API password"
                  style={{ flex: 1, minWidth: 160 }}
                />
              </div>
            </EditorialDefinitionRow>
          </EditorialDefinitionList>
        </section>

        <section className="mt-10">
          <EditorialSectionHeader
            title="Apify"
            meta="Competitor Ads Library scraping · Cold Email leads finder"
          />
          <EditorialDefinitionList>
            <EditorialDefinitionRow
              label="API token"
              labelSub={
                apifyView?.set ? `Saved: ${apifyView.masked}` : 'Not configured'
              }
            >
              <EditorialField
                value={apifyForm.apiKey}
                onChange={(v) => setApifyForm((prev) => ({ ...prev, apiKey: v }))}
                type="password"
                placeholder={apifyView?.placeholder ?? 'apify_api_…'}
                style={{ maxWidth: 420 }}
              />
            </EditorialDefinitionRow>
            <EditorialDefinitionRow label="Competitor scraper actor">
              <select
                value={apifyForm.actor}
                onChange={(e) =>
                  setApifyForm((prev) => ({
                    ...prev,
                    actor: e.target.value as ApifyMetaAdsActorId,
                  }))
                }
                className="w-full max-w-[520px] border-0 border-b border-[#C2B79A] bg-transparent py-2.5 pl-2 font-[family-name:var(--font-display)] text-[15px] font-medium text-[var(--primary)] outline-none"
              >
                {APIFY_META_ADS_ACTORS.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.label}
                  </option>
                ))}
              </select>
            </EditorialDefinitionRow>
            <EditorialDefinitionRow label="Ads Library scraper actor" isLast>
              <select
                value={apifyForm.adsLibraryActor}
                onChange={(e) =>
                  setApifyForm((prev) => ({
                    ...prev,
                    adsLibraryActor: e.target.value as ApifyMetaAdsActorId,
                  }))
                }
                className="w-full max-w-[520px] border-0 border-b border-[#C2B79A] bg-transparent py-2.5 pl-2 font-[family-name:var(--font-display)] text-[15px] font-medium text-[var(--primary)] outline-none"
              >
                {APIFY_META_ADS_ACTORS.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.label}
                  </option>
                ))}
              </select>
            </EditorialDefinitionRow>
          </EditorialDefinitionList>
        </section>

        <AiModuleSettings
          readOnly={readOnly}
          gatewayForm={aiGatewayForm}
          onGatewayFormChange={(key, value) => setAiGatewayForm((prev) => ({ ...prev, [key]: value }))}
          savedGateways={aiGateways}
          connection={aiConnection}
          onConnectionChange={(patch) => setAiConnection((prev) => ({ ...prev, ...patch }))}
          routes={aiRoutes}
          onRouteChange={handleAiRouteChange}
          apiTokenHints={[
            ...apiTokenSecrets.map((t) => ({ key: t.key, set: t.set })),
            { key: 'apify', set: apifyView?.set ?? false },
          ]}
        />

        <section className="mt-12">
          <EditorialSectionHeader
            title="API Tokens"
            meta="Third-party services · OpenAI and Google Gemini keys feed the direct providers above"
          />
          <div className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
            {apiTokenSecrets.map((token) => (
              <div key={token.key} className="border-b border-[var(--border)] py-[18px]">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <div className="font-[family-name:var(--font-display)] text-[14.5px] font-semibold text-[var(--primary)]">
                    {token.label}
                  </div>
                  <div className="text-[11.5px] text-[var(--text-muted)]">
                    {token.set ? `Saved: ${token.masked}` : 'Not configured'}
                  </div>
                </div>
                <EditorialField
                  value={apiTokenForm[token.key] ?? ''}
                  onChange={(v) => setApiTokenForm((prev) => ({ ...prev, [token.key]: v }))}
                  type="password"
                  placeholder="••••••••"
                />
              </div>
            ))}
          </div>

          {!readOnly && (
            <footer className="mt-6 flex justify-end">
              <button type="submit" disabled={saving} className={editorialPillButtonClass}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save integrations'
                )}
              </button>
            </footer>
          )}
        </section>
      </fieldset>
    </form>
  );
}
