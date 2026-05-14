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
        <SectionTitle title="API 数据源状态监控" subtitle="接口密钥配置、限额、延迟与响应诊断" />
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge variant="bullish">{counts.healthy} 正常</Badge>
          <Badge variant="warn">{counts.degraded} 降级</Badge>
          <Badge variant="neutral">{counts.missing} 缺密钥</Badge>
          {counts.limited > 0 && <Badge variant="extreme">{counts.limited} 受限</Badge>}
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
                <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">类别: {translateCategory(source.category)} · 优先级: {source.priority}</div>
              </div>
              <Badge variant={variantForStatus(source.status)} className="text-[9px]">
                {labelForStatus(source.status)}
              </Badge>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed min-h-[2.5rem]">{source.message}</p>

            <div className="flex flex-wrap gap-1.5 text-[10px] text-gray-500 font-mono">
              <span className="rounded border border-slate-800 px-1.5 py-0.5">
                {source.isRealtime ? '支持实时' : '不支持实时'}
              </span>
              <span className="rounded border border-slate-800 px-1.5 py-0.5">
                {source.isDelayed ? `延迟 ${formatDelay(source.delaySeconds)}` : '无延迟标记'}
              </span>
              {source.lastUpdated && (
                <span className="rounded border border-slate-800 px-1.5 py-0.5">
                  最近查询: {new Date(source.lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function translateCategory(cat: string) {
  const map: Record<string, string> = {
    market: '核心行情',
    macro: '宏观数据',
    news: '财经资讯',
    crypto: '加密货币',
    china: '中国A股',
  };
  return map[cat.toLowerCase()] || cat;
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
  if (status === 'missing_key') return 'API 密钥缺失';
  if (status === 'limit_reached') return 'API 限频达到上限';
  if (status === 'healthy') return '运行正常';
  if (status === 'degraded') return '降级服务';
  if (status === 'not_supported') return '不支持当前环境';
  if (status === 'offline') return '接口离线';
  return '未知状态';
}

function formatDelay(seconds: number) {
  if (seconds >= 86400) return '按日更新';
  if (seconds >= 3600) return `约 ${Math.round(seconds / 3600)} 小时`;
  if (seconds >= 60) return `约 ${Math.round(seconds / 60)} 分钟`;
  return `${seconds} 秒`;
}
