'use client';

import { DataSourceStatus } from '@/lib/types';
import { Card, Badge, SectionTitle } from './Cards';
import { CheckCircle2, CircleSlash, KeyRound, ServerCrash, TimerReset } from 'lucide-react';

export function SourceHealthPanel({ sources }: { sources: DataSourceStatus[] }) {
  if (!sources || sources.length === 0) return null;

  const counts = {
    healthy: sources.filter(source => source.status === 'healthy').length,
    missing: sources.filter(source => source.status === 'missing_key').length,
    limited: sources.filter(source => source.status === 'limit_reached').length,
    degraded: sources.filter(source => source.status === 'degraded' || source.status === 'not_supported').length,
  };

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3 border-b border-gray-800/50 pb-2">
        <SectionTitle title="API Health" subtitle="免费源配置、限额、延迟与缓存状态" />
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge variant="bullish">{counts.healthy} OK</Badge>
          <Badge variant="warn">{counts.degraded} DEGRADED</Badge>
          <Badge variant="neutral">{counts.missing} MISSING</Badge>
          {counts.limited > 0 && <Badge variant="extreme">{counts.limited} LIMITED</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {sources.map((source) => (
          <div key={source.id} className="rounded-lg border border-slate-800 bg-slate-950/45 p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {iconForStatus(source.status)}
                  <span className="text-xs font-bold text-gray-200 truncate">{source.name}</span>
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">{source.category} · priority {source.priority}</div>
              </div>
              <Badge variant={variantForStatus(source.status)} className="text-[9px]">
                {labelForStatus(source.status)}
              </Badge>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed min-h-[2.5rem]">{source.message}</p>

            <div className="flex flex-wrap gap-1.5 text-[10px] text-gray-500 font-mono">
              <span className="rounded border border-slate-800 px-1.5 py-0.5">
                {source.isRealtime ? 'realtime' : 'not realtime'}
              </span>
              <span className="rounded border border-slate-800 px-1.5 py-0.5">
                {source.isDelayed ? `delay ${formatDelay(source.delaySeconds)}` : 'no delay flag'}
              </span>
              {source.lastUpdated && (
                <span className="rounded border border-slate-800 px-1.5 py-0.5">
                  updated {new Date(source.lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function iconForStatus(status: DataSourceStatus['status']) {
  if (status === 'healthy') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === 'missing_key') return <KeyRound className="h-3.5 w-3.5 text-amber-400" />;
  if (status === 'limit_reached') return <TimerReset className="h-3.5 w-3.5 text-red-400" />;
  if (status === 'not_supported') return <CircleSlash className="h-3.5 w-3.5 text-gray-500" />;
  return <ServerCrash className="h-3.5 w-3.5 text-orange-400" />;
}

function variantForStatus(status: DataSourceStatus['status']) {
  if (status === 'healthy') return 'bullish';
  if (status === 'limit_reached') return 'extreme';
  if (status === 'missing_key' || status === 'degraded') return 'warn';
  return 'neutral';
}

function labelForStatus(status: DataSourceStatus['status']) {
  if (status === 'missing_key') return 'API key missing';
  if (status === 'limit_reached') return 'API limit reached';
  return status.replace('_', ' ');
}

function formatDelay(seconds: number) {
  if (seconds >= 86400) return 'daily';
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}
