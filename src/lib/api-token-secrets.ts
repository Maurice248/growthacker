import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/integration-crypto';
import {
  buildDataForSeoCredential,
  toDataForSeoCredentialView,
  type DataForSeoCredentialView,
} from '@/lib/dataforseo-credentials';

export const API_TOKEN_SECRET_DEFINITIONS = [
  { key: 'apify', label: 'Apify', placeholder: 'apify_api_…' },
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

/** Stored in apiTokenSecretsEnc but edited via dedicated login/password fields. */
export const DATAFORSEO_SECRET_KEY = 'dataforseo' as const;

export type ApiTokenSecretKey = (typeof API_TOKEN_SECRET_DEFINITIONS)[number]['key'];

export type ApiTokenSecretsMap = Record<ApiTokenSecretKey, string> & {
  dataforseo: string;
};

export type ApiTokenSecretView = {
  key: ApiTokenSecretKey;
  label: string;
  placeholder: string;
  set: boolean;
  masked: string;
};

const EMPTY_SECRETS = Object.fromEntries(
  API_TOKEN_SECRET_DEFINITIONS.map((d) => [d.key, ''])
) as ApiTokenSecretsMap;

function parseSecretsEnc(value: string | null | undefined): ApiTokenSecretsMap {
  if (!value) return { ...EMPTY_SECRETS, dataforseo: '' };
  try {
    const parsed = JSON.parse(decryptSecret(value)) as Partial<ApiTokenSecretsMap> & {
      dataforseo?: string;
    };
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...EMPTY_SECRETS, dataforseo: '' };
    }
    return {
      ...EMPTY_SECRETS,
      ...Object.fromEntries(
        API_TOKEN_SECRET_DEFINITIONS.map((d) => [d.key, parsed[d.key]?.trim() || ''])
      ),
      dataforseo: parsed.dataforseo?.trim() || '',
    } as ApiTokenSecretsMap;
  } catch {
    return { ...EMPTY_SECRETS, dataforseo: '' };
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

export async function getCompanyApiTokenSecrets(companyId: string): Promise<ApiTokenSecretsMap> {
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
  input: Partial<Record<ApiTokenSecretKey, string>> & {
    dataforseo?: string;
    dataforseoLogin?: string;
    dataforseoPassword?: string;
  }
): Promise<ApiTokenSecretView[]> {
  const existing = await getCompanyApiTokenSecrets(companyId);
  const merged = { ...existing };

  for (const def of API_TOKEN_SECRET_DEFINITIONS) {
    const value = input[def.key]?.trim();
    if (value) merged[def.key] = value;
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

  return toApiTokenSecretsView(merged);
}

export function getDataForSeoCredentialView(
  secrets: ApiTokenSecretsMap
): DataForSeoCredentialView {
  return toDataForSeoCredentialView(secrets.dataforseo);
}
