import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from '@/lib/cn';

type Variant = 'primary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-blue-700 text-white hover:bg-blue-800 focus:ring-blue-500 border border-blue-700',
  danger:
    'bg-red-700 text-white hover:bg-red-800 focus:ring-red-500 border border-red-700',
  ghost:
    'bg-transparent text-yellow-300 hover:bg-gray-800 focus:ring-yellow-400 border border-transparent',
  outline:
    'bg-transparent text-white hover:bg-gray-800 focus:ring-gray-400 border border-gray-500',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2.5 text-base min-h-[44px]',
  lg: 'px-6 py-3 text-lg min-h-[52px]',
  xl: 'px-8 py-4 text-xl min-h-[64px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth, className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-semibold',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors duration-150',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = 'Button';
