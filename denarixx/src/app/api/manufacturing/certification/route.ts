import { NextRequest, NextResponse } from 'next/server';
import { getCertificationMilestones, getMilestonesByPhase, getImmediateMilestones, buildRoadmapSummary } from '@/engines/certificationRoadmapEngine';
import { getComplianceRegistry, getComplianceWarnings } from '@/engines/compliancePlanningEngine';
import type { CertificationPhase } from '@/types/manufacturing';

export async function GET(req: NextRequest) {
  const phase = req.nextUrl.searchParams.get('phase') as CertificationPhase | null;
  const immediate = req.nextUrl.searchParams.get('immediate') === 'true';

  const milestones = getCertificationMilestones();
  const compliance = getComplianceRegistry();
  const warnings = getComplianceWarnings(compliance);
  const summary = buildRoadmapSummary(milestones);

  let filteredMilestones = milestones;
  if (immediate) filteredMilestones = getImmediateMilestones(milestones);
  else if (phase) filteredMilestones = getMilestonesByPhase(milestones, phase);

  return NextResponse.json({ milestones: filteredMilestones, summary, warnings, complianceItems: compliance });
}
