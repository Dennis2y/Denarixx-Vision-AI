import { clsx } from '@/lib/cn';

type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'muted';

const variantClasses: Record<BadgeVariant, string> = {
  critical: 'bg-red-900 text-red-200 border border-red-600',
  high: 'bg-orange-900 text-orange-200 border border-orange-600',
  medium: 'bg-yellow-900 text-yellow-200 border border-yellow-600',
  low: 'bg-blue-900 text-blue-200 border border-blue-600',
  info: 'bg-sky-900 text-sky-200 border border-sky-600',
  success: 'bg-green-900 text-green-200 border border-green-600',
  muted: 'bg-gray-800 text-gray-300 border border-gray-600',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'muted', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
