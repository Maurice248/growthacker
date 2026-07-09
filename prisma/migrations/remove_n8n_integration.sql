-- Drop retired n8n integration columns from company_integrations
ALTER TABLE company_integrations DROP COLUMN IF EXISTS "n8nApiKeyEnc";
ALTER TABLE company_integrations DROP COLUMN IF EXISTS "n8nApiBaseUrl";
ALTER TABLE company_integrations DROP COLUMN IF EXISTS "n8nBlogWorkflowId";
ALTER TABLE company_integrations DROP COLUMN IF EXISTS "n8nBlogWorkflowName";
ALTER TABLE company_integrations DROP COLUMN IF EXISTS "n8nWebhooksJson";

ALTER TABLE company_integrations DROP COLUMN IF EXISTS "n8nCredentialRefsJson";

-- Rename legacy n8n execution id column
ALTER TABLE workflow_executions RENAME COLUMN "n8nExecutionId" TO "externalExecutionId";
