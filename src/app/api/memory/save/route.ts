import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { getMemoryEngine } from '@/engines/MemoryEngine';

const schema = z.object({
  type: z.enum(['location', 'person', 'route', 'preference', 'object']),
  label: z.string().min(1).max(200),
  description: z.string().max(1000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const item = await getMemoryEngine().save({ ...body, metadata: body.metadata ?? {} });
    return ok({ item }, 201);
  } catch (e) {
    return handleError(e);
  }
}
