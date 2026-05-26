import { cn } from '@/lib/cn';

interface ConfidenceRingProps {
  value: number;

  size?: number;

  stroke?: number;

  showLabel?: boolean;
  className?: string;
}

function colorForValue(value: number): string {
  if (value >= 0.75) return '#047857';
  if (value >= 0.5) return '#d97706';
  if (value >= 0.3) return '#ea580c';
  return '#dc2626';
}

export function ConfidenceRing({
  value,
  size = 56,
  stroke = 5,
  showLabel = true,
  className,
}: ConfidenceRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const finalOffset = circumference * (1 - clamped);
  const color = colorForValue(clamped);

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={finalOffset}
          className="animate-draw-ring"
          style={
            {
              '--ring-circumference': `${circumference}`,
              '--ring-final-offset': `${finalOffset}`,
            } as React.CSSProperties
          }
        />
      </svg>
      {showLabel ? (
        <span
          className="absolute font-mono text-[11px] font-semibold tabular-nums"
          style={{ color }}
        >
          {Math.round(clamped * 100)}
        </span>
      ) : null}
    </div>
  );
}
