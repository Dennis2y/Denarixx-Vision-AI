import { NextResponse } from 'next/server';
import { getHardwareComponentRegistry, calculateReadinessScore, buildRecommendedNextActions, getManufacturingOptions } from '@/engines/manufacturingReadinessEngine';
import { getComplianceRegistry, calculateComplianceScore } from '@/engines/compliancePlanningEngine';
import { getProductRiskRegistry } from '@/engines/productRiskEngine';
import { getCertificationMilestones } from '@/engines/certificationRoadmapEngine';
import { MANUFACTURING_DISCLAIMER } from '@/types/manufacturing';
import type { ManufacturingReadinessReport } from '@/types/manufacturing';

export async function GET() {
  const specs = getHardwareComponentRegistry();
  const compliance = getComplianceRegistry();
  const risks = getProductRiskRegistry();
  const milestones = getCertificationMilestones();
  const options = getManufacturingOptions();

  const complianceScore = calculateComplianceScore(compliance);
  const score = calculateReadinessScore(specs, 45, complianceScore, 60);

  const report: ManufacturingReadinessReport = {
    reportId: `readiness-${Date.now()}`,
    generatedAt: Date.now(),
    score,
    componentSpecs: specs,
    complianceItems: compliance,
    risks,
    manufacturingOptions: options,
    certificationMilestones: milestones,
    recommendedNextActions: buildRecommendedNextActions(specs),
    manufacturingDisclaimer: MANUFACTURING_DISCLAIMER,
  };

  return NextResponse.json({ report });
}
