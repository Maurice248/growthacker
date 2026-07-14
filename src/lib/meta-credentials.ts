import { getCompanyIntegrations, getRequestCompanyIntegrations } from '@/lib/company-integrations';

export type MetaCredentials = {
  accessToken: string;
  adAccountId: string;
  pageId: string | null;
};

export function normalizeAdAccountId(raw: string) {
  return raw.replace(/^act_/i, '').trim();
}

export async function getMetaCredentialsForCompany(companyId: string): Promise<MetaCredentials | null> {
  const creds = await getCompanyIntegrations(companyId);
  const accessToken = creds.metaAccessToken?.trim() || null;
  const adAccountId = normalizeAdAccountId(creds.metaAdAccountId || '');
  const pageId = creds.metaPageId?.trim() || null;
  if (!accessToken || !adAccountId) return null;
  return { accessToken, adAccountId, pageId };
}

export async function getMetaCredentialsForRequest() {
  const creds = await getRequestCompanyIntegrations();
  const accessToken = creds.metaAccessToken?.trim() || null;
  const adAccountId = normalizeAdAccountId(creds.metaAdAccountId || '');
  const pageId = creds.metaPageId?.trim() || null;

  if (!accessToken || !adAccountId) return null;
  return { accessToken, adAccountId, pageId };
}

export async function getMetaAccessTokenForRequest() {
  const creds = await getRequestCompanyIntegrations();
  return creds.metaAccessToken?.trim() || null;
}
