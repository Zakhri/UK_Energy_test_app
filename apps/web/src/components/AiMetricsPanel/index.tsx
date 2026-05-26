import {
  CircleDollarSign,
  Coins,
  Database,
  Gauge,
  PercentCircle,
  ShieldCheck,
  ShieldX,
  Timer,
  Zap,
} from 'lucide-react';

import { useMetrics } from '../../hooks/useMetrics.js';
import { MetricTile } from './MetricTile.js';

interface AiMetricsPanelProps {
  readonly compact?: boolean;
}

export function AiMetricsPanel({ compact = false }: AiMetricsPanelProps = {}) {
  const { data } = useMetrics();
  const stats = data?.last24h;
  const ready = stats !== undefined;

  return (
    <section className="panel transition-shadow hover:shadow-lift">
      <div className="panel-heading">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <h2 className="panel-title">Pipeline health · last 24h</h2>
            <p className="panel-subtitle">Auto-refreshes every 30 seconds</p>
          </div>
        </div>
        {data && !compact ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live · {new Date(data.snapshotAt).toLocaleTimeString('en-GB')}
          </span>
        ) : null}
      </div>

      <div
        className={
          compact
            ? 'grid auto-rows-fr grid-cols-2 gap-2'
            : 'grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8'
        }
      >
        <MetricTile icon={Zap} label="Calls" value={stats?.totalCalls ?? 0} ready={ready} />
        <MetricTile
          icon={Database}
          label="Cache hit"
          value={stats ? Math.round(stats.cacheHitRate * 100) : 0}
          suffix="%"
          ready={ready}
        />
        <MetricTile
          icon={Timer}
          label="P95 latency"
          value={stats?.p95LatencyMs ?? 0}
          suffix="ms"
          ready={ready}
        />
        <MetricTile
          icon={PercentCircle}
          label="Avg confidence"
          value={stats ? Math.round(stats.avgConfidence * 100) : 0}
          suffix="%"
          ready={ready}
        />
        <MetricTile
          icon={CircleDollarSign}
          label="Spend"
          value={stats?.totalCostUsd ?? 0}
          prefix="$"
          decimals={4}
          ready={ready}
        />
        <MetricTile
          icon={ShieldCheck}
          label="Schema valid"
          value={stats ? Math.round(stats.schemaValidityRate * 100) : 0}
          suffix="%"
          ready={ready}
        />
        <MetricTile
          icon={Coins}
          label="Avg input"
          value={stats?.avgInputTokens ?? 0}
          suffix="tok"
          ready={ready}
        />
        <MetricTile
          icon={ShieldX}
          label="Refused"
          value={stats ? Math.round(stats.refusalRate * 100) : 0}
          suffix="%"
          ready={ready}
        />
      </div>
    </section>
  );
}
