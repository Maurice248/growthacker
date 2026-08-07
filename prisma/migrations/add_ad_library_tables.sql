-- Live Facebook Ads Library search results (per company)

CREATE TABLE IF NOT EXISTS public.ad_library_searches (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  search_key TEXT NOT NULL,
  query TEXT NOT NULL DEFAULT '',
  search_type TEXT NOT NULL DEFAULT 'keyword_unordered',
  view_all_page_id TEXT NOT NULL DEFAULT '',
  countries TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  active_status TEXT NOT NULL DEFAULT 'all',
  ad_category TEXT NOT NULL DEFAULT 'all',
  media_type TEXT NOT NULL DEFAULT 'all',
  platforms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  languages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  start_date_min TEXT NOT NULL DEFAULT '',
  start_date_max TEXT NOT NULL DEFAULT '',
  actor_id TEXT NOT NULL DEFAULT 'curious_coder',
  apify_run_id TEXT NOT NULL DEFAULT '',
  apify_dataset_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  total_found INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE (company_id, search_key)
);

CREATE INDEX IF NOT EXISTS ad_library_searches_company_id_status_idx
  ON public.ad_library_searches (company_id, status);

CREATE TABLE IF NOT EXISTS public.ad_library_ads (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  page_id TEXT NOT NULL DEFAULT '',
  page_name TEXT NOT NULL DEFAULT '',
  page_url TEXT NOT NULL DEFAULT '',
  ad_type TEXT NOT NULL DEFAULT 'text',
  start_date TEXT NOT NULL DEFAULT '',
  platforms TEXT NOT NULL DEFAULT '',
  hook TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  framework TEXT NOT NULL DEFAULT '',
  angles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  hashtags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  strength TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  has_video BOOLEAN NOT NULL DEFAULT false,
  impressions_text TEXT,
  impressions_min INTEGER,
  impressions_max INTEGER,
  reach_countries TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ad_active BOOLEAN,
  language_code TEXT NOT NULL DEFAULT '',
  video_duration_sec INTEGER,
  copy_char_count INTEGER NOT NULL DEFAULT 0,
  raw JSONB,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, ad_id)
);

CREATE INDEX IF NOT EXISTS ad_library_ads_company_id_ad_type_idx
  ON public.ad_library_ads (company_id, ad_type);

CREATE INDEX IF NOT EXISTS ad_library_ads_company_id_last_seen_at_idx
  ON public.ad_library_ads (company_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.ad_library_search_hits (
  id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL REFERENCES public.ad_library_searches(id) ON DELETE CASCADE,
  ad_library_ad_id TEXT NOT NULL REFERENCES public.ad_library_ads(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE (search_id, ad_library_ad_id)
);

CREATE INDEX IF NOT EXISTS ad_library_search_hits_search_id_position_idx
  ON public.ad_library_search_hits (search_id, position);
