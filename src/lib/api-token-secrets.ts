import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/integration-crypto';
import {
  buildDataForSeoCredential,
  toDataForSeoCredentialView,
  type DataForSeoCredentialView,
} from '@/lib/dataforseo-credentials';
import { AI_GATEWAY_KEY_FIELDS, type AiGatewayKeyField } from '@/lib/ai-module-routing';
import {
  DEFAULT_APIFY_META_ADS_ACTOR,
  resolveApifyActorId,
  type ApifyMetaAdsActorId,
} from '@/lib/competitor-analysis/apify-actors';

export const API_TOKEN_SECRET_DEFINITIONS = [
  { key: 'openai', label: 'OpenAI', placeholder: 'sk-…' },
  { key: 'assemblyai', label: 'AssemblyAI', placeholder: '…' },
  { key: 'elevenLabs', label: 'ElevenLabs', placeholder: 'sk_…' },
  { key: 'kie', label: 'KIE', placeholder: '…' },
  { key: 'uploadPost', label: 'Upload Post', placeholder: 'API key from Upload Post dashboard (Apikey …)' },
  { key: 'googleGemini', label: 'Google Gemini', placeholder: 'AIza…' },
  { key: 'resend', label: 'Resend', placeholder: 're_…' },
  { key: 'millionVerifier', label: 'Million Verifier', placeholder: '…' },
  { key: 'instantlyAi', label: 'Instantly.ai', placeholder: '…' },
] as const;

/** Apify API key — edited in the dedicated Apify section, not the generic API Tokens grid. */
export const APIFY_API_KEY = 'apify' as const;

/** Stored in apiTokenSecretsEnc but edited via dedicated login/password fields. */
export const DATAFORSEO_SECRET_KEY = 'dataforseo' as const;

/** Stored alongside the API tokens but edited in the AI Gateways section. */
export const AI_GATEWAY_SECRET_DEFINITIONS = AI_GATEWAY_KEY_FIELDS.map((field) => ({
  key: field.key,
  label: field.label,
  placeholder: field.placeholder,
}));

export type ApiTokenSecretKey =
  | (typeof API_TOKEN_SECRET_DEFINITIONS)[number]['key']
  | typeof APIFY_API_KEY;

export type ApiTokenSecretsMap = Record<ApiTokenSecretKey, string> &
  Record<AiGatewayKeyField, string> & {
    dataforseo: string;
  };

export type CompanyApiTokenStore = ApiTokenSecretsMap & {
  competitorApifyActor: ApifyMetaAdsActorId;
  adsLibraryApifyActor: ApifyMetaAdsActorId;
};

export type ApiTokenSecretView = {
  key: (typeof API_TOKEN_SECRET_DEFINITIONS)[number]['key'];
  label: string;
  placeholder: string;
  set: boolean;
  masked: string;
};

export type ApifyIntegrationView = {
  set: boolean;
  masked: string;
  placeholder: string;
  competitorApifyActor: ApifyMetaAdsActorId;
  adsLibraryApifyActor: ApifyMetaAdsActorId;
};

export type AiGatewaySecretView = {
  key: AiGatewayKeyField;
  label: string;
  placeholder: string;
  set: boolean;
  masked: string;
};

const EMPTY_SECRETS: CompanyApiTokenStore = {
  apify: '',
  competitorApifyActor: DEFAULT_APIFY_META_ADS_ACTOR,
  adsLibraryApifyActor: DEFAULT_APIFY_META_ADS_ACTOR,
  ...Object.fromEntries(API_TOKEN_SECRET_DEFINITIONS.map((d) => [d.key, ''])),
  ...Object.fromEntries(AI_GATEWAY_SECRET_DEFINITIONS.map((d) => [d.key, ''])),
  dataforseo: '',
} as CompanyApiTokenStore;

type ParsedSecretsBlob = Partial<ApiTokenSecretsMap> & {
  dataforseo?: string;
  competitorApifyActor?: string;
  adsLibraryApifyActor?: string;
};

function parseSecretsEnc(value: string | null | undefined): CompanyApiTokenStore {
  if (!value) return { ...EMPTY_SECRETS };
  try {
    const parsed = JSON.parse(decryptSecret(value)) as ParsedSecretsBlob;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...EMPTY_SECRETS };
    }
    return {
      ...EMPTY_SECRETS,
      apify: parsed.apify?.trim() || '',
      competitorApifyActor: resolveApifyActorId(parsed.competitorApifyActor),
      adsLibraryApifyActor: resolveApifyActorId(
        parsed.adsLibraryApifyActor ?? parsed.competitorApifyActor
      ),
      ...Object.fromEntries(
        API_TOKEN_SECRET_DEFINITIONS.map((d) => [d.key, parsed[d.key]?.trim() || ''])
      ),
      ...Object.fromEntries(
        AI_GATEWAY_SECRET_DEFINITIONS.map((d) => [d.key, parsed[d.key]?.trim() || ''])
      ),
      dataforseo: parsed.dataforseo?.trim() || '',
    };
  } catch {
    return { ...EMPTY_SECRETS };
  }
}

export function toApiTokenSecretsView(secrets: ApiTokenSecretsMap): ApiTokenSecretView[] {
  return API_TOKEN_SECRET_DEFINITIONS.map((def) => {
    const secret = secrets[def.key] || '';
    return {
      key: def.key,
      label: def.label,
      placeholder: def.placeholder,
      set: Boolean(secret),
      masked: secret ? maskSecret(secret) : '',
    };
  });
}

export function toApifyIntegrationView(store: CompanyApiTokenStore): ApifyIntegrationView {
  const secret = store.apify || '';
  return {
    set: Boolean(secret),
    masked: secret ? maskSecret(secret) : '',
    placeholder: 'apify_api_…',
    competitorApifyActor: store.competitorApifyActor,
    adsLibraryApifyActor: store.adsLibraryApifyActor,
  };
}

export function toAiGatewaySecretsView(secrets: ApiTokenSecretsMap): AiGatewaySecretView[] {
  return AI_GATEWAY_SECRET_DEFINITIONS.map((def) => {
    const secret = secrets[def.key] || '';
    return {
      key: def.key,
      label: def.label,
      placeholder: def.placeholder,
      set: Boolean(secret),
      masked: secret ? maskSecret(secret) : '',
    };
  });
}

export async function getCompanyApiTokenSecrets(companyId: string): Promise<CompanyApiTokenStore> {
  const rows = await prisma.$queryRaw<
    Array<{ apiTokenSecretsEnc: string | null; elevenLabsApiKeyEnc: string | null }>
  >`
    SELECT "apiTokenSecretsEnc", "elevenLabsApiKeyEnc"
    FROM company_integrations
    WHERE "companyId" = ${companyId}
    LIMIT 1
  `;
  const secrets = parseSecretsEnc(rows[0]?.apiTokenSecretsEnc ?? null);
  if (!secrets.elevenLabs?.trim() && rows[0]?.elevenLabsApiKeyEnc) {
    try {
      secrets.elevenLabs = decryptSecret(rows[0].elevenLabsApiKeyEnc).trim();
    } catch {
      // ignore invalid legacy value
    }
  }
  return secrets;
}

export async function upsertCompanyApiTokenSecrets(
  companyId: string,
  input: Partial<Record<ApiTokenSecretKey | AiGatewayKeyField, string>> & {
    dataforseo?: string;
    dataforseoLogin?: string;
    dataforseoPassword?: string;
    competitorApifyActor?: string;
    adsLibraryApifyActor?: string;
  }
): Promise<{ tokens: ApiTokenSecretView[]; apify: ApifyIntegrationView }> {
  const existing = await getCompanyApiTokenSecrets(companyId);
  const merged: CompanyApiTokenStore = { ...existing };

  for (const def of [...API_TOKEN_SECRET_DEFINITIONS, ...AI_GATEWAY_SECRET_DEFINITIONS]) {
    const value = input[def.key]?.trim();
    if (value) merged[def.key] = value;
  }

  const apifyValue = input.apify?.trim();
  if (apifyValue) merged.apify = apifyValue;

  if (input.competitorApifyActor !== undefined) {
    merged.competitorApifyActor = resolveApifyActorId(input.competitorApifyActor);
  }
  if (input.adsLibraryApifyActor !== undefined) {
    merged.adsLibraryApifyActor = resolveApifyActorId(input.adsLibraryApifyActor);
  }

  const combinedDataForSeo = buildDataForSeoCredential(
    existing.dataforseo,
    input.dataforseoLogin,
    input.dataforseoPassword
  );
  if (input.dataforseo?.trim()) {
    merged.dataforseo = input.dataforseo.trim();
  } else if (combinedDataForSeo) {
    merged.dataforseo = combinedDataForSeo;
  }

  const payload = encryptSecret(JSON.stringify(merged));

  await prisma.companyIntegration.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });

  await prisma.$executeRaw`
    UPDATE company_integrations
    SET "apiTokenSecretsEnc" = ${payload}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "companyId" = ${companyId}
  `;

  if (merged.elevenLabs?.trim()) {
    const elevenLabsEnc = encryptSecret(merged.elevenLabs.trim());
    await prisma.$executeRaw`
      UPDATE company_integrations
      SET "elevenLabsApiKeyEnc" = ${elevenLabsEnc}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "companyId" = ${companyId}
    `;
  }

  return {
    tokens: toApiTokenSecretsView(merged),
    apify: toApifyIntegrationView(merged),
  };
}

export function getDataForSeoCredentialView(
  secrets: ApiTokenSecretsMap
): DataForSeoCredentialView {
  return toDataForSeoCredentialView(secrets.dataforseo);
}
