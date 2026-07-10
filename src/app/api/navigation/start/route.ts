import { ok, err, handleError } from '@/lib/api';
import { createNavigationSession } from '@/engines/navigationIntelligenceEngine';
import { saveNavigationSession } from '@/lib/navigationStore';
import type { NavigationMode } from '@/types/navigation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destination, mode, locationConsent } = body as {
      destination?: string;
      mode?: NavigationMode;
      locationConsent?: boolean;
    };

    if (!destination?.trim()) {
      return err('destination is required', 400);
    }
    const navMode: NavigationMode = mode === 'indoor' ? 'indoor' : 'outdoor';
    const session = createNavigationSession(
      destination.trim(),
      navMode,
      locationConsent === true,
    );
    saveNavigationSession(session);

    return ok({
      sessionId: session.sessionId,
      mode: session.mode,
      destination: session.destination,
      state: session.state,
      segmentCount: session.segments.length,
      totalDistanceM: session.distanceRemainingM,
      firstInstruction: session.segments[0]?.instruction ?? null,
      privacy: session.privacy,
      simulated: true,
    });
  } catch (e) {
    return handleError(e);
  }
}
