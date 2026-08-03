'use client';

import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { EditorialDefinitionList, EditorialDefinitionRow, EditorialField } from '@/app/components';
import { EditorialSectionHeader } from '@/components/editorial/editorial-layout';
import { OutreachSelect } from '@/components/cold-email/outreach-ui';
import {
  AI_DIRECT_MODELS,
  AI_GATEWAY_KEY_FIELDS,
  AI_GATEWAY_MODELS,
  AI_MODULE_DESCRIPTIONS,
  AI_MODULE_IDS,
  AI_MODULE_LABELS,
  AI_PROVIDER_IDS,
  AI_PROVIDER_LABELS,
  AI_VENDOR_IDS,
  AI_VENDOR_LABELS,
  OPENROUTER_DEFAULT_BASE_URL,
  VERCEL_AI_GATEWAY_DEFAULT_BASE_URL,
  defaultGatewayModel,
  directProviderSecretKey,
  gatewayProviderSecretKey,
  isGatewayProvider,
  type AiDirectProviderId,
  type AiGatewayConnectionSettings,
  type AiGatewayKeyField,
  type AiGatewayProviderId,
  type AiModuleId,
  type AiModuleRoute,
  type AiModuleRoutingMap,
  type AiProviderId,
  type AiVendorId,
} from '@/lib/ai-module-routing';

type ApiTokenHint = { key: string; set: boolean };
type GatewaySecretHint = { key: AiGatewayKeyField; set: boolean; masked: string };

type AiModuleSettingsProps = {
  readOnly?: boolean;
  gatewayForm: Record<AiGatewayKeyField, string>;
  onGatewayFormChange: (key: AiGatewayKeyField, value: string) => void;
  savedGateways: Record<AiGatewayKeyField, GatewaySecretHint>;
  connection: AiGatewayConnectionSettings;
  onConnectionChange: (patch: Partial<AiGatewayConnectionSettings>) => void;
  routes: AiModuleRoutingMap;
  onRouteChange: (moduleId: AiModuleId, patch: Partial<AiModuleRoute>) => void;
  apiTokenHints: ApiTokenHint[];
};

function tokenSet(hints: ApiTokenHint[], key: string): boolean {
  return hints.find((t) => t.key === key)?.set ?? false;
}

function providerReady(
  provider: AiProviderId,
  hints: ApiTokenHint[],
  gateways: Record<AiGatewayKeyField, GatewaySecretHint>,
  gatewayForm: Record<AiGatewayKeyField, string>
): boolean {
  const direct = directProviderSecretKey(provider);
  if (direct) return tokenSet(hints, direct);

  const gateway = gatewayProviderSecretKey(provider);
  if (!gateway) return false;
  if (gatewayForm[gateway]?.trim()) return true;
  return gateways[gateway].set;
}

/** Keeps a previously saved slug selectable even if it is not in the catalog. */
function withCurrentValue(options: string[], value: string): string[] {
  return value && !options.includes(value) ? [value, ...options] : options;
}

function modelOptionsFor(route: AiModuleRoute, provider: AiProviderId): string[] {
  if (isGatewayProvider(provider)) {
    const gateway = route[provider];
    return withCurrentValue(AI_GATEWAY_MODELS[provider][gateway.vendor], gateway.model);
  }
  return withCurrentValue(AI_DIRECT_MODELS[provider as AiDirectProviderId], route[provider].model);
}

function ProviderRow({
  moduleId,
  provider,
  route,
  readOnly,
  onRouteChange,
  ready,
}: {
  moduleId: AiModuleId;
  provider: AiProviderId;
  route: AiModuleRoute;
  readOnly: boolean;
  onRouteChange: AiModuleSettingsProps['onRouteChange'];
  ready: boolean;
}) {
  const selected = route.selected === provider;
  const isGateway = isGatewayProvider(provider);
  const model = route[provider].model;

  const handleVendorChange = (vendor: AiVendorId) => {
    const gatewayId = provider as AiGatewayProviderId;
    onRouteChange(moduleId, {
      [gatewayId]: { vendor, model: defaultGatewayModel(gatewayId, vendor) },
    } as Partial<AiModuleRoute>);
  };

  const handleModelChange = (nextModel: string) => {
    const current = route[provider];
    onRouteChange(moduleId, {
      [provider]: { ...current, model: nextModel },
    } as Partial<AiModuleRoute>);
  };

  return (
    <div className="grid grid-cols-1 items-center gap-x-6 gap-y-3 border-b border-[var(--border)] py-3.5 sm:grid-cols-[minmax(180px,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={readOnly}
          onChange={() => onRouteChange(moduleId, { selected: provider })}
          aria-label={`Use ${AI_PROVIDER_LABELS[provider]} for ${AI_MODULE_LABELS[moduleId]}`}
          className="h-[15px] w-[15px] shrink-0 accent-[var(--red)]"
        />
        <span
          className={
            selected
              ? 'text-[14px] font-semibold text-[var(--primary)]'
              : 'text-[14px] text-[#4A5A64]'
          }
        >
          {AI_PROVIDER_LABELS[provider]}
        </span>
        {selected && !ready && (
          <span
            title="Missing API key"
            className="flex items-center gap-1 text-[11.5px] text-[var(--red)]"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            No key
          </span>
        )}
      </label>

      <div>
        {isGateway ? (
          <OutreachSelect
            value={route[provider].vendor}
            onChange={(vendor) => handleVendorChange(vendor as AiVendorId)}
            disabled={readOnly}
            options={AI_VENDOR_IDS.map((id) => ({ value: id, label: AI_VENDOR_LABELS[id] }))}
          />
        ) : (
          <span className="text-[12.5px] text-[var(--text-muted)]">Direct provider</span>
        )}
      </div>

      <OutreachSelect
        value={model}
        onChange={handleModelChange}
        disabled={readOnly}
        options={modelOptionsFor(route, provider).map((id) => ({ value: id, label: id }))}
      />
    </div>
  );
}

export function AiModuleSettings({
  readOnly = false,
  gatewayForm,
  onGatewayFormChange,
  savedGateways,
  connection,
  onConnectionChange,
  routes,
  onRouteChange,
  apiTokenHints,
}: AiModuleSettingsProps) {
  const [showOpenRouterAdvanced, setShowOpenRouterAdvanced] = useState(false);
  const [showGatewayAdvanced, setShowGatewayAdvanced] = useState(false);

  return (
    <>
      <section className="mt-12">
        <EditorialSectionHeader
          title="AI Gateways"
          meta="OpenAI-compatible keys for OpenRouter and Vercel AI Gateway"
        />
        <p className="mb-6 max-w-3xl text-[13px] leading-relaxed text-[var(--text-muted)]">
          Keys are encrypted per company and used by the module routing below. Leave a field blank to
          keep the saved key.
        </p>

        <div className="space-y-10">
          {AI_GATEWAY_KEY_FIELDS.map((field) => {
            const saved = savedGateways[field.key];
            const isOpenRouter = field.key === 'openrouter';
            const advancedOpen = isOpenRouter ? showOpenRouterAdvanced : showGatewayAdvanced;
            const toggleAdvanced = () =>
              isOpenRouter
                ? setShowOpenRouterAdvanced((v) => !v)
                : setShowGatewayAdvanced((v) => !v);

            return (
              <div key={field.key} className="border-b border-[var(--border)] pb-8">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <div className="font-[family-name:var(--font-display)] text-[14.5px] font-semibold text-[var(--primary)]">
                    {field.label}
                  </div>
                  <div className="text-[11.5px] text-[var(--text-muted)]">
                    {saved.set ? `Saved: ${saved.masked}` : 'Not configured'}
                  </div>
                </div>
                <p className="mb-3 text-[12px] text-[var(--text-muted)]">{field.hint}</p>
                <EditorialField
                  value={gatewayForm[field.key] ?? ''}
                  onChange={(v) => onGatewayFormChange(field.key, v)}
                  type="password"
                  placeholder={field.placeholder}
                  disabled={readOnly}
                />

                <button
                  type="button"
                  onClick={toggleAdvanced}
                  className="mt-4 flex items-center gap-1.5 text-[12px] font-bold text-[#4A5A64] hover:text-[var(--primary)]"
                >
                  {advancedOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  Connection options
                </button>

                {advancedOpen && (
                  <div className="mt-4 pl-1">
                    <EditorialDefinitionList>
                      <EditorialDefinitionRow
                        label="Base URL"
                        labelSub={
                          isOpenRouter
                            ? `Default ${OPENROUTER_DEFAULT_BASE_URL}`
                            : `Default ${VERCEL_AI_GATEWAY_DEFAULT_BASE_URL}`
                        }
                        isLast
                      >
                        <EditorialField
                          value={
                            isOpenRouter
                              ? connection.openrouterBaseUrl
                              : connection.vercelGatewayBaseUrl
                          }
                          onChange={(v) =>
                            isOpenRouter
                              ? onConnectionChange({ openrouterBaseUrl: v })
                              : onConnectionChange({ vercelGatewayBaseUrl: v })
                          }
                          disabled={readOnly}
                          placeholder={
                            isOpenRouter ? OPENROUTER_DEFAULT_BASE_URL : VERCEL_AI_GATEWAY_DEFAULT_BASE_URL
                          }
                          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
                        />
                      </EditorialDefinitionRow>
                    </EditorialDefinitionList>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <EditorialSectionHeader
          title="Module AI routing"
          meta="Tick the provider each module should use, then pick its provider and model"
        />
        <p className="mb-8 max-w-3xl text-[13px] leading-relaxed text-[var(--text-muted)]">
          One provider per module. Gateways route through a vendor of your choice; direct providers
          call OpenAI or Gemini with the keys saved under API Keys.
        </p>

        <div className="space-y-12">
          {AI_MODULE_IDS.map((moduleId) => {
            const route = routes[moduleId];
            const selectedReady = providerReady(
              route.selected,
              apiTokenHints,
              savedGateways,
              gatewayForm
            );

            return (
              <div key={moduleId}>
                <div className="mb-1 font-[family-name:var(--font-display)] text-[15px] font-bold uppercase tracking-[0.08em] text-[var(--primary)]">
                  {AI_MODULE_LABELS[moduleId]}
                </div>
                <p className="mb-3 text-[12px] text-[var(--text-muted)]">
                  {AI_MODULE_DESCRIPTIONS[moduleId]}
                </p>

                <div className="hidden grid-cols-[minmax(180px,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-x-6 border-b border-[var(--primary)] pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] sm:grid">
                  <span className="font-[family-name:var(--font-display)]">Use</span>
                  <span className="font-[family-name:var(--font-display)]">Provider</span>
                  <span className="font-[family-name:var(--font-display)]">Model</span>
                </div>

                {AI_PROVIDER_IDS.map((provider) => (
                  <ProviderRow
                    key={provider}
                    moduleId={moduleId}
                    provider={provider}
                    route={route}
                    readOnly={readOnly}
                    onRouteChange={onRouteChange}
                    ready={providerReady(provider, apiTokenHints, savedGateways, gatewayForm)}
                  />
                ))}

                {!selectedReady && (
                  <div className="mt-2 flex items-start gap-1.5 text-[11.5px] text-[var(--red)]">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Add {AI_PROVIDER_LABELS[route.selected]} credentials
                      {directProviderSecretKey(route.selected)
                        ? ' under API Tokens'
                        : ' under AI Gateways'}{' '}
                      before this module can run.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
