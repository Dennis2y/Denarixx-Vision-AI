import { clsx } from '@/lib/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  role?: string;
  'aria-label'?: string;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-gray-700 bg-gray-900 p-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-3 flex items-center justify-between', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={clsx('text-lg font-bold text-white', className)}>{children}</h2>
  );
}
