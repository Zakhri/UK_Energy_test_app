import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { colorFor } from './_lib/colorFor.js';
import type { ImpactPoint } from './_lib/types.js';

export interface ResolvedBand {
  readonly id: string;
  readonly startTick: string;
  readonly endTick: string;
  readonly label: string;

  readonly score: number;
}

interface ImpactBarChartProps {
  points: readonly ImpactPoint[];

  nowTick: string | null;

  resolvedBands: { scheme: 'recommend' | 'compare' | 'none'; bands: ResolvedBand[] };
}

const COMPARE_FILL = '#6366f1';
const COMPARE_STROKE = '#4f46e5';
const RECOMMEND_FILL = '#10b981';
const RECOMMEND_STROKE = '#047857';

export function ImpactBarChart({ points, nowTick, resolvedBands }: ImpactBarChartProps) {
  return (
    <div className="h-40 w-full animate-fade-in">
      <ResponsiveContainer>
        <BarChart
          data={points as ImpactPoint[]}
          margin={{ top: 16, right: 12, left: -10, bottom: 4 }}
        >
          <defs>
            <pattern
              id="unreliable-stripes"
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="#fff1f2" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#dc2626" strokeWidth="2" opacity="0.5" />
            </pattern>
          </defs>
          <CartesianGrid strokeDasharray="2 6" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="iso"
            stroke="#94a3b8"
            fontSize={10}
            interval={Math.max(3, Math.floor(points.length / 6))}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickMargin={6}
            tickFormatter={(value: string) => {
              const point = points.find((p) => p.iso === value);
              return point?.time ?? value;
            }}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={10}
            width={36}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={(value: number) => `${value}`}
          />
          {resolvedBands.bands.map((band) => {
            const isRecommend = resolvedBands.scheme === 'recommend';
            const fill = isRecommend ? RECOMMEND_FILL : COMPARE_FILL;
            const stroke = isRecommend ? RECOMMEND_STROKE : COMPARE_STROKE;
            // Compare bands fade by score so the winner pops; recommend
            // bands use a single fixed opacity.
            const fillOpacity = isRecommend ? 0.12 : 0.08 + band.score * 0.18;
            return (
              <ReferenceArea
                key={band.id}
                x1={band.startTick}
                x2={band.endTick}
                ifOverflow="visible"
                fill={fill}
                fillOpacity={fillOpacity}
                stroke={stroke}
                strokeOpacity={0.4}
                strokeDasharray="4 3"
                label={{
                  value: band.label,
                  position: 'insideTop',
                  fill: stroke,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
            );
          })}
          {nowTick ? (
            <ReferenceLine
              x={nowTick}
              stroke="#047857"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              ifOverflow="visible"
              label={{
                value: '● now',
                position: 'top',
                fill: '#047857',
                fontSize: 10,
                fontWeight: 700,
              }}
            />
          ) : null}
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              boxShadow: '0 10px 30px -12px rgba(0,0,0,0.12)',
              fontSize: 11,
              padding: '6px 10px',
            }}
            labelStyle={{ color: '#475569', fontWeight: 600 }}
            cursor={{ fill: 'rgba(16,185,129,0.06)' }}
            formatter={(value, _name, item) => {
              const payload = item?.payload as ImpactPoint | undefined;
              const intensity = payload?.intensity ?? 0;
              const suffix = payload?.unreliable
                ? ' ⚠ forecast looked implausible — excluded from stats'
                : '';
              return [`${value as number} kg CO₂ (${intensity} g/kWh)${suffix}`, 'Impact'];
            }}
          />
          <Bar dataKey="kgCo2" radius={[3, 3, 0, 0]}>
            {points.map((point) => (
              <Cell
                key={point.iso}
                fill={point.unreliable ? 'url(#unreliable-stripes)' : colorFor(point.intensity)}
                {...(point.unreliable
                  ? { stroke: '#dc2626', strokeWidth: 1, strokeOpacity: 0.4 }
                  : {})}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
