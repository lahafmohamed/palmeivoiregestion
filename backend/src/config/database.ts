import { PrismaClient } from '../../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import env from './env.js';

// Typage pour globalThis
declare global {
  var prisma: PrismaClient | undefined;
}

// Singleton PrismaClient - évite les connexions multiples en développement
function getPrismaClient(): PrismaClient {
  if (global.prisma) {
    return global.prisma;
  }

  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });

  const client = new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

  // En développement, stocker l'instance sur globalThis pour le hot reload
  if (env.NODE_ENV === 'development') {
    global.prisma = client;
  }

  return client;
}

const db = getPrismaClient();

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await db.$disconnect();
  process.exit(0);
});

export default db;
