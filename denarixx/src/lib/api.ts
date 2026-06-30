import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    const issues = (e as ZodError & { issues?: Array<{message: string}>, errors?: Array<{message: string}> }).issues ?? (e as ZodError & { errors?: Array<{message: string}> }).errors ?? [];
    return err(issues.map((x) => x.message).join('; '), 422);
  }
  const message = e instanceof Error ? e.message : 'Internal server error';
  console.error('[API]', e);
  return err(message, 500);
}
