import { cn } from '@/lib/cn';
import type { CSSProperties, ReactNode } from 'react';

interface MotionPanelProps {
  children: ReactNode;

  index?: number;

  delayMs?: number;
  className?: string;

  as?: 'div' | 'section' | 'article';
}

export function MotionPanel({
  children,
  index = 0,
  delayMs,
  className,
  as: Component = 'div',
}: MotionPanelProps) {
  const style: CSSProperties = {
    ...(delayMs !== undefined
      ? { animationDelay: `${delayMs}ms` }
      : ({ ['--i' as never]: index } as CSSProperties)),
  };

  return (
    <Component className={cn('animate-fade-up', className)} style={style}>
      {children}
    </Component>
  );
}
