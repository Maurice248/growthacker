-- Native blog pipeline tables (BlogConfig, BlogCategory, BlogJob)

CREATE TABLE IF NOT EXISTS "blog_configs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "title_prompt" TEXT NOT NULL DEFAULT '',
  "article_system_prompt" TEXT NOT NULL DEFAULT '',
  "article_user_prompt" TEXT NOT NULL DEFAULT '',
  "image_prompt_system" TEXT NOT NULL DEFAULT '',
  "run_hour" INTEGER NOT NULL DEFAULT 7,
  "run_minute" INTEGER NOT NULL DEFAULT 0,
  "run_timezone" TEXT NOT NULL DEFAULT 'UTC',
  "days_interval" INTEGER NOT NULL DEFAULT 3,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "post_status" TEXT NOT NULL DEFAULT 'publish',
  "image_size" TEXT NOT NULL DEFAULT '16:9',
  "dataforseo_location_code" INTEGER NOT NULL DEFAULT 2124,
  "openai_model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "last_category_index" INTEGER NOT NULL DEFAULT 0,
  "last_run_at" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "blog_configs_companyId_key" ON "blog_configs"("companyId");

ALTER TABLE "blog_configs"
  DROP CONSTRAINT IF EXISTS "blog_configs_companyId_fkey";
ALTER TABLE "blog_configs"
  ADD CONSTRAINT "blog_configs_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "blog_categories" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "service" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL,
  "seed_keyword" TEXT NOT NULL DEFAULT '',
  "keywords" JSONB NOT NULL DEFAULT '[]',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "blog_categories_companyId_idx" ON "blog_categories"("companyId");
CREATE INDEX IF NOT EXISTS "blog_categories_companyId_active_idx" ON "blog_categories"("companyId", "active");

ALTER TABLE "blog_categories"
  DROP CONSTRAINT IF EXISTS "blog_categories_companyId_fkey";
ALTER TABLE "blog_categories"
  ADD CONSTRAINT "blog_categories_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "blog_jobs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "category_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "title" TEXT,
  "slug" TEXT,
  "article_html" TEXT,
  "image_prompt" TEXT,
  "image_task_id" TEXT,
  "image_url" TEXT,
  "wordpress_post_id" INTEGER,
  "wordpress_post_url" TEXT,
  "error_message" TEXT,
  "input" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "blog_jobs_companyId_idx" ON "blog_jobs"("companyId");
CREATE INDEX IF NOT EXISTS "blog_jobs_companyId_status_idx" ON "blog_jobs"("companyId", "status");
CREATE INDEX IF NOT EXISTS "blog_jobs_createdAt_idx" ON "blog_jobs"("createdAt" DESC);

ALTER TABLE "blog_jobs"
  DROP CONSTRAINT IF EXISTS "blog_jobs_companyId_fkey";
ALTER TABLE "blog_jobs"
  ADD CONSTRAINT "blog_jobs_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blog_jobs"
  DROP CONSTRAINT IF EXISTS "blog_jobs_category_id_fkey";
ALTER TABLE "blog_jobs"
  ADD CONSTRAINT "blog_jobs_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
