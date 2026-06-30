// Prisma client — only usable after `npm run db:generate` with a real DB configured.
// In Phase 1 simulation mode the app runs without a database.
// Engines use in-memory stores. The Prisma client here is loaded lazily.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPrisma(): any {
  if (_prisma) return _prisma;
  try {
    // Dynamic require so the app does not crash when Prisma client is not generated
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client');
    _prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
    return _prisma;
  } catch {
    console.warn(
      '[Prisma] Client not available. Run `npm run db:generate` to enable database features.'
    );
    return null;
  }
}

export const prisma = getPrisma();
