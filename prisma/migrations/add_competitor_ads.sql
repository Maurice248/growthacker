-- Competitor ads scraped from Meta Ads Library (per company)
CREATE TABLE IF NOT EXISTS public.competitor_ads (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
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
  raw JSONB,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, ad_id)
);

CREATE INDEX IF NOT EXISTS competitor_ads_company_id_ad_type_idx
  ON public.competitor_ads (company_id, ad_type);

CREATE INDEX IF NOT EXISTS competitor_ads_company_id_last_seen_at_idx
  ON public.competitor_ads (company_id, last_seen_at DESC);
