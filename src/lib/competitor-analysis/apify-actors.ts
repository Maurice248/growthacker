export const APIFY_META_ADS_ACTORS = [
  {
    id: 'curious_coder',
    slug: 'curious_coder~facebook-ads-library-scraper',
    label: 'curious_coder / facebook-ads-library-scraper',
  },
  {
    id: 'apify_official',
    slug: 'apify~facebook-ads-scraper',
    label: 'apify / facebook-ads-scraper (OFFICIAL)',
  },
  {
    id: 'whoareyouanas',
    slug: 'whoareyouanas~meta-ad-scraper',
    label: 'whoareyouanas / meta-ad-scraper',
  },
] as const;

export type ApifyMetaAdsActorId = (typeof APIFY_META_ADS_ACTORS)[number]['id'];

export const DEFAULT_APIFY_META_ADS_ACTOR: ApifyMetaAdsActorId = 'curious_coder';

export function resolveApifyActorId(value: unknown): ApifyMetaAdsActorId {
  if (typeof value === 'string' && APIFY_META_ADS_ACTORS.some((a) => a.id === value)) {
    return value as ApifyMetaAdsActorId;
  }
  return DEFAULT_APIFY_META_ADS_ACTOR;
}

export function getApifyActorSlug(actorId: ApifyMetaAdsActorId): string {
  return APIFY_META_ADS_ACTORS.find((a) => a.id === actorId)!.slug;
}
