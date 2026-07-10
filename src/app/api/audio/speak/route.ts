import { z } from 'zod';
import { ok, handleError } from '@/lib/api';

// Audio output is handled client-side via Web Speech API.
// This route logs the speech request and returns the text for client TTS.

const schema = z.object({
  text: z.string().min(1).max(1000),
  priority: z.enum(['critical', 'high', 'normal', 'low']).default('normal'),
  interrupt: z.boolean().default(false),
  sessionId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    // In production: could trigger server-sent events or WebSocket push
    return ok({
      text: body.text,
      priority: body.priority,
      interrupt: body.interrupt,
      instruction: 'speak_client_side',
    });
  } catch (e) {
    return handleError(e);
  }
}
