// Run after `npm run db:generate` and `npm run db:push`
// Usage: npm run db:seed

async function main() {
  let PrismaClient;
  try {
    ({ PrismaClient } = await import('@prisma/client'));
  } catch {
    console.error('Prisma client not generated. Run: npm run db:generate && npm run db:push');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  console.log('Seeding Denarixx Vision AI database…');

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@denarixx.ai' },
    update: {},
    create: { email: 'demo@denarixx.ai', displayName: 'Demo User' },
  });

  await prisma.userPreference.createMany({
    skipDuplicates: true,
    data: [
      { userId: demoUser.id, key: 'speechRate', value: '1.0' },
      { userId: demoUser.id, key: 'speechVolume', value: '1.0' },
      { userId: demoUser.id, key: 'alertVerbosity', value: 'full' },
      { userId: demoUser.id, key: 'hazardSensitivity', value: 'medium' },
      { userId: demoUser.id, key: 'theme', value: 'high-contrast' },
    ],
  });

  await prisma.consentRecord.createMany({
    skipDuplicates: true,
    data: [
      { userId: demoUser.id, feature: 'analytics', granted: true },
      { userId: demoUser.id, feature: 'face_recognition', granted: false },
      { userId: demoUser.id, feature: 'emergency_streaming', granted: false },
    ],
  });

  await prisma.memoryItem.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: demoUser.id,
        type: 'location',
        label: 'Home entrance',
        description: 'Front door of home. Steps down, then flat path.',
        metadata: JSON.stringify({ indoor: false }),
      },
      {
        userId: demoUser.id,
        type: 'location',
        label: 'Local café',
        description: 'Favourite café. Counter is 10 steps ahead from entrance.',
        metadata: JSON.stringify({ indoor: true }),
      },
    ],
  });

  console.log('Seed complete.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
