import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { getConversationEngine } from '@/engines/ConversationEngine';
import type { SceneDescription } from '@/types';

const schema = z.object({
  sessionId: z.string().min(1),
  question: z.string().min(1).max(500),
  context: z
    .object({
      summary: z.string(),
      confidence: z.number(),
      detections: z.array(z.object({ label: z.string(), confidence: z.number() })),
      timestamp: z.string().or(z.date()),
      isUncertain: z.boolean(),
      uncertaintyMessage: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const context = body.context
      ? ({ ...body.context, timestamp: new Date(body.context.timestamp) } as SceneDescription)
      : null;
    const answer = await getConversationEngine().ask(body.question, context);
    return ok({ sessionId: body.sessionId, question: body.question, answer });
  } catch (e) {
    return handleError(e);
  }
}
