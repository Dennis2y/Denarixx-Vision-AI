import { NextRequest, NextResponse } from 'next/server';
import { getProductRiskRegistry, getRisksByLevel, getRisksByCategory, getCriticalOpenRisks, getRiskSummary } from '@/engines/productRiskEngine';
import type { RiskLevel, RiskCategory } from '@/types/manufacturing';

export async function GET(req: NextRequest) {
  const level = req.nextUrl.searchParams.get('level') as RiskLevel | null;
  const category = req.nextUrl.searchParams.get('category') as RiskCategory | null;
  const criticalOnly = req.nextUrl.searchParams.get('critical') === 'true';

  let risks = getProductRiskRegistry();

  if (criticalOnly) risks = getCriticalOpenRisks(risks);
  else if (level) risks = getRisksByLevel(risks, level);
  else if (category) risks = getRisksByCategory(risks, category);

  return NextResponse.json({ risks, summary: getRiskSummary(getProductRiskRegistry()) });
}
