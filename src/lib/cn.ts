// Minimal className utility — no clsx dependency needed
export function clsx(...inputs: (string | undefined | null | false | 0)[]): string {
  return inputs.filter(Boolean).join(' ');
}
