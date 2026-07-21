CREATE TABLE IF NOT EXISTS "platform_module_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "meta_enabled" BOOLEAN NOT NULL DEFAULT true,
  "social_enabled" BOOLEAN NOT NULL DEFAULT true,
  "newsletter_enabled" BOOLEAN NOT NULL DEFAULT true,
  "outreach_enabled" BOOLEAN NOT NULL DEFAULT true,
  "blog_enabled" BOOLEAN NOT NULL DEFAULT true,
  "maintenance_message" TEXT NOT NULL DEFAULT 'This module is under maintenance. Please check back later.',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_module_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_module_settings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
