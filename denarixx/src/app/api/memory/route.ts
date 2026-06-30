import { ok, handleError } from '@/lib/api';
import { getMemoryEngine } from '@/engines/MemoryEngine';

export async function GET() {
  try {
    const items = await getMemoryEngine().getAll();
    return ok({ items, count: items.length });
  } catch (e) {
    return handleError(e);
  }
}
