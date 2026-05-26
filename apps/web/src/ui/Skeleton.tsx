import { cn } from '@/lib/cn';

export type SkeletonVariant = 'text' | 'line' | 'number' | 'card' | 'chart' | 'pill' | 'circle';

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  count?: number;
  delayMs?: number;
}

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  text: 'h-3.5 w-full rounded',
  line: 'h-2 w-full rounded-full',
  number: 'h-7 w-24 rounded-md',
  card: 'h-32 w-full rounded-2xl',
  chart: 'h-56 w-full rounded-2xl',
  pill: 'h-6 w-20 rounded-full',
  circle: 'h-12 w-12 rounded-full',
};

export function Skeleton({ variant = 'text', className, count = 1, delayMs = 100 }: SkeletonProps) {
  const blocks = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={cn('skeleton-surface', VARIANT_CLASSES[variant], className)}
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden="true"
    />
  ));

  if (count === 1) return blocks[0] ?? null;
  return <div className="space-y-2">{blocks}</div>;
}
