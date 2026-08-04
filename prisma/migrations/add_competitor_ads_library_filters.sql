-- Filter facets for Ads Library (countries, status, language, copy/video length)
ALTER TABLE public.competitor_ads
  ADD COLUMN IF NOT EXISTS reach_countries TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS ad_active BOOLEAN,
  ADD COLUMN IF NOT EXISTS language_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_duration_sec INTEGER,
  ADD COLUMN IF NOT EXISTS copy_char_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS competitor_ads_company_id_language_idx
  ON public.competitor_ads (company_id, language_code);
