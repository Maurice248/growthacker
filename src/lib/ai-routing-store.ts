import { prisma } from '@/lib/prisma';
import {
  defaultAiModuleRouting,
  defaultGatewayConnectionSettings,
  parseAiModuleRouting,
  parseGatewayConnection,
  type AiGatewayConnectionSettings,
  type AiModuleRoutingMap,
} from '@/lib/ai-module-routing';

export type AiRoutingConfig = {
  routes: AiModuleRoutingMap;
  connection: AiGatewayConnectionSettings;
  /** False until a company saves routing, so untouched modules keep their built-in model defaults. */
  configured: boolean;
};

export function defaultAiRoutingConfig(): AiRoutingConfig {
  return {
    routes: defaultAiModuleRouting(),
    connection: defaultGatewayConnectionSettings(),
    configured: false,
  };
}

function parseConfig(raw: unknown): AiRoutingConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultAiRoutingConfig();
  const entry = raw as { routes?: unknown; connection?: unknown };
  return {
    routes: parseAiModuleRouting(entry.routes),
    connection: parseGatewayConnection(entry.connection),
    configured: true,
  };
}

export async function getCompanyAiRouting(companyId: string): Promise<AiRoutingConfig> {
  const rows = await prisma.$queryRaw<Array<{ aiRoutingConfig: unknown }>>`
    SELECT "aiRoutingConfig"
    FROM company_integrations
    WHERE "companyId" = ${companyId}
    LIMIT 1
  `;
  return parseConfig(rows[0]?.aiRoutingConfig ?? null);
}

export async function saveCompanyAiRouting(
  companyId: string,
  input: { routes?: unknown; connection?: unknown }
): Promise<AiRoutingConfig> {
  const existing = await getCompanyAiRouting(companyId);
  const next: AiRoutingConfig = {
    routes: input.routes === undefined ? existing.routes : parseAiModuleRouting(input.routes),
    connection:
      input.connection === undefined
        ? existing.connection
        : parseGatewayConnection(input.connection),
    configured: true,
  };

  await prisma.companyIntegration.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });

  const payload = JSON.stringify({ routes: next.routes, connection: next.connection });
  await prisma.$executeRaw`
    UPDATE company_integrations
    SET "aiRoutingConfig" = ${payload}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "companyId" = ${companyId}
  `;

  return next;
}
