-- Per-company saved Ads Library filter presets (like Brand & ICP templates)

CREATE TABLE IF NOT EXISTS public.ad_library_saved_filters (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  filters JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ad_library_saved_filters_company_created_idx
  ON public.ad_library_saved_filters (company_id, created_at DESC);
