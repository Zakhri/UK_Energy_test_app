import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  durationMs?: number;
  format?: (n: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export function AnimatedNumber({
  value,
  decimals = 0,
  durationMs = 900,
  format,
  className,
  prefix = '',
  suffix = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayValue(value);
      previousValue.current = value;
      return;
    }

    const from = previousValue.current;
    const to = value;
    const start = performance.now();
    let frameId = 0;

    const tick = (now: number): void => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutQuart(progress);
      const next = from + (to - from) * eased;
      setDisplayValue(next);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        previousValue.current = to;
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, durationMs]);

  const text = format
    ? format(displayValue)
    : displayValue.toLocaleString('en-GB', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
