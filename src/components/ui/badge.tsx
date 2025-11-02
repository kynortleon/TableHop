import { cn } from '@/lib/utils/cn';

const variants = {
  default: 'bg-primary text-primary-foreground',
  outline: 'border border-primary/60 text-primary'
} as const;

type Variant = keyof typeof variants;

export function Badge({
  variant = 'default',
  children,
  className
}: {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
