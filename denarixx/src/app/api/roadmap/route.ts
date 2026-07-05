// GET /api/roadmap — returns live project progress by detecting completed test files

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { SPRINT_REGISTRY, computeProgress } from '@/engines/projectProgressEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const testsDir = path.join(process.cwd(), 'tests');

  const completedFiles = new Set<string>();
  for (const sprint of SPRINT_REGISTRY) {
    const full = path.join(testsDir, sprint.testFile);
    if (fs.existsSync(full)) {
      completedFiles.add(sprint.testFile);
    }
  }

  const progress = computeProgress(completedFiles);
  return NextResponse.json({ ok: true, data: progress });
}
