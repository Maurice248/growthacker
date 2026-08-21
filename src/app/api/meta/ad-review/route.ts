import { NextResponse } from 'next/server';
import { getMetaAccessTokenForRequest } from '@/lib/meta-credentials';
import { requireMetaApiAuth } from '@/lib/meta-api-auth';

export const dynamic = 'force-dynamic';

const FULL_FIELDS = 'id,name,effective_status,status,ad_review_feedback,issues_info,recommendations';
const FALLBACK_FIELDS = 'id,name,effective_status,status,issues_info';

export type AdReviewReason = {
  title: string;
  detail: string;
  placement?: string;
  source: 'policy' | 'placement' | 'issue' | 'recommendation';
};

function humanizeKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function stringifyFeedbackValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => stringifyFeedbackValue(item)).filter(Boolean).join(' ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferred =
      record.text ||
      record.message ||
      record.description ||
      record.reason ||
      record.summary;
    if (preferred) return stringifyFeedbackValue(preferred);
    return Object.entries(record)
      .map(([k, v]) => `${humanizeKey(k)}: ${stringifyFeedbackValue(v)}`)
      .filter((part) => !part.endsWith(': '))
      .join('. ');
  }
  return '';
}

function addFeedbackMap(
  reasons: AdReviewReason[],
  map: unknown,
  placement?: string,
) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return;
  for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
    if (key === 'global' || key === 'placement_specific') continue;
    const detail = stringifyFeedbackValue(value);
    if (!detail && !key) continue;
    reasons.push({
      title: humanizeKey(key),
      detail,
      placement: placement ? humanizeKey(placement) : undefined,
      source: placement ? 'placement' : 'policy',
    });
  }
}

function flattenReviewFeedback(feedback: unknown): AdReviewReason[] {
  const reasons: AdReviewReason[] = [];
  if (!feedback || typeof feedback !== 'object') return reasons;

  const record = feedback as Record<string, unknown>;
  addFeedbackMap(reasons, record.global);

  const placement = record.placement_specific;
  if (placement && typeof placement === 'object' && !Array.isArray(placement)) {
    for (const [place, map] of Object.entries(placement as Record<string, unknown>)) {
      addFeedbackMap(reasons, map, place);
    }
  }

  if (!record.global && !record.placement_specific) {
    addFeedbackMap(reasons, record);
  }

  return reasons;
}

function flattenIssues(issues: unknown): AdReviewReason[] {
  if (!Array.isArray(issues)) return [];
  return issues
    .map((issue) => {
      if (!issue || typeof issue !== 'object') return null;
      const row = issue as Record<string, unknown>;
      const title =
        stringifyFeedbackValue(row.error_summary) ||
        (row.error_code != null ? `Issue ${row.error_code}` : 'Delivery issue');
      const detail = stringifyFeedbackValue(row.error_message);
      if (!title && !detail) return null;
      return {
        title,
        detail,
        source: 'issue' as const,
      };
    })
    .filter(Boolean) as AdReviewReason[];
}

function flattenRecommendations(recs: unknown): AdReviewReason[] {
  if (!Array.isArray(recs)) return [];
  return recs
    .map((rec) => {
      if (!rec || typeof rec !== 'object') return null;
      const row = rec as Record<string, unknown>;
      const title = stringifyFeedbackValue(row.title) || 'Recommendation';
      const detail = stringifyFeedbackValue(row.message) || stringifyFeedbackValue(row.blame_field);
      if (!title && !detail) return null;
      return {
        title,
        detail,
        source: 'recommendation' as const,
      };
    })
    .filter(Boolean) as AdReviewReason[];
}

function dedupeReasons(reasons: AdReviewReason[]) {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = `${reason.title}|${reason.detail}|${reason.placement || ''}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchAdReview(adId: string, accessToken: string, fields: string) {
  const url =
    `https://graph.facebook.com/v21.0/${encodeURIComponent(adId)}` +
    `?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  return { response, data };
}

export async function GET(request: Request) {
  const auth = await requireMetaApiAuth();
  if (auth instanceof NextResponse) return auth;

  const accessToken = await getMetaAccessTokenForRequest();
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Missing Meta credentials. Configure them in Client Dashboard → API keys.' },
      { status: 500 }
    );
  }

  const adId = new URL(request.url).searchParams.get('adId')?.trim() || '';
  if (!/^\d+$/.test(adId)) {
    return NextResponse.json({ error: 'A valid ad ID is required' }, { status: 400 });
  }

  try {
    let { response, data } = await fetchAdReview(adId, accessToken, FULL_FIELDS);
    if (!response.ok) {
      const retry = await fetchAdReview(adId, accessToken, FALLBACK_FIELDS);
      if (retry.response.ok) {
        response = retry.response;
        data = retry.data;
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'Meta API Error fetching ad review' },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 }
      );
    }

    const reasons = dedupeReasons([
      ...flattenReviewFeedback(data.ad_review_feedback),
      ...flattenIssues(data.issues_info),
      ...flattenRecommendations(data.recommendations),
    ]);

    return NextResponse.json({
      id: data.id,
      name: data.name || '',
      status: data.effective_status || data.status || '',
      reasons,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch ad review reasons' },
      { status: 500 }
    );
  }
}
