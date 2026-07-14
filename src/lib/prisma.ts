import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

function isStalePrismaClient(client: PrismaClient): boolean {
  return !('adAutomation' in (client as unknown as Record<string, unknown>));
}

function getPrismaClient() {
  const existing = globalForPrisma.prisma;
  // Hot reload can keep a Prisma singleton from before new models were generated.
  if (existing && isStalePrismaClient(existing)) {
    void existing.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
