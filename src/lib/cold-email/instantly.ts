export type InstantlyLeadPayload = {
  campaign: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  personalization?: string;
  custom_variables?: {
    subject_line?: string;
    city?: string;
  };
};

export async function pushLeadToInstantly(
  apiKey: string,
  payload: InstantlyLeadPayload
): Promise<{ success: boolean; id?: string; error?: string }> {
  const res = await fetch('https://api.instantly.ai/api/v2/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    return {
      success: false,
      error: String(data.error || data.message || `HTTP ${res.status}`),
    };
  }

  return {
    success: true,
    id: typeof data.id === 'string' ? data.id : undefined,
  };
}

export async function bulkDeleteLeadsFromInstantly(
  apiKey: string,
  campaignId: string,
  emails: string[]
): Promise<{ success: boolean; deleted: number; error?: string }> {
  if (emails.length === 0) {
    return { success: true, deleted: 0 };
  }

  const res = await fetch('https://api.instantly.ai/api/v2/leads', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ campaign_id: campaignId, emails }),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = { message: text };
  }

  const hasError = !res.ok || Boolean(data.error);
  const deleted = Number(data.deleted ?? data.count ?? (hasError ? 0 : emails.length));

  return {
    success: !hasError,
    deleted: Number.isFinite(deleted) ? deleted : 0,
    error: hasError ? String(data.error || data.message || `HTTP ${res.status}`) : undefined,
  };
}
