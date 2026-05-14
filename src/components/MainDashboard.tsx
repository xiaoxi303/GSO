'use client';

import useSWR from 'swr';
import { DashboardOverview, NewsItem, RiskSignal, MarketSummary } from '@/lib/types';
import { MarketOverview } from './MarketOverview';
import { AISummaryCard } from './AISummaryCard';
import { SectorHeatmap } from './SectorHeatmap';
import { NewsFeed } from './NewsFeed';
import { FundFlowWidget } from './FundFlowWidget';
import { RiskPanel } from './RiskPanel';
import { SourceHealthPanel } from './SourceHealthPanel';
import { Badge } from './Cards';
import { Globe, RefreshCw, Radio, ShieldCheck, WifiOff } from 'lucide-react';

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed: ${response.status}`);
  }
  return data as unknown as T;
};

export default function MainDashboard() {
  const { data: overview, mutate: mutateOverview, isValidating: isOverviewValidating } = useSWR<DashboardOverview>(
    '/api/market/overview',
    fetcher,
    { refreshInterval: 60_000 },
  );
  const { data: news, mutate: mutateNews } = useSWR<NewsItem[]>('/api/news/latest', fetcher, { refreshInterval: 120_000 });
  const { data: risks, mutate: mutateRisks } = useSWR<RiskSignal[]>('/api/risk/signals', fetcher, { refreshInterval: 120_000 });
  const { data: summary, mutate: mutateSummary } = useSWR<MarketSummary>('/api/ai/market-summary', fetcher, { refreshInterval: 300_000 });

  const topStatus = overview?.status;
  const riskMood = overview?.riskMood || 'Neutral';
  const lastUpdated = topStatus?.lastUpdated ? new Date(topStatus.lastUpdated).toLocaleTimeString() : '--';

  const triggerManualRefresh = async () => {
    await Promise.all([mutateOverview(), mutateNews(), mutateRisks(), mutateSummary()]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 font-sans flex flex-col">
      <header className="border-b border-slate-800/60 bg-slate-950/90 sticky top-0 z-50 backdrop-blur-lg px-4 sm:px-6 py-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div className="flex items-center gap-3 select-none">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base md:text-lg font-black tracking-wider uppercase text-gray-100">
                Global Market Intelligence
              </h1>
              <Badge variant={topStatus?.apiHealth === 'healthy' ? 'bullish' : topStatus?.apiHealth === 'offline' ? 'bearish' : 'warn'}>
                {topStatus?.apiHealth ?? 'loading'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 font-mono mt-1">
              <span className="flex items-center gap-1">
                {topStatus?.realtimeConnected ? <ShieldCheck className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-amber-400" />}
                {topStatus?.realtimeConnected ? 'realtime source connected' : 'free/delayed sources only'}
              </span>
              <span className="hidden sm:inline">|</span>
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-blue-400" />
                {topStatus?.dataDelay || '等待数据源'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold font-mono text-gray-500 uppercase">Risk Mood</span>
            <Badge
              variant={riskMood === 'Risk On' ? 'bullish' : riskMood === 'Risk Off' ? 'bearish' : 'neutral'}
              className="py-1 px-3 uppercase font-bold tracking-widest"
            >
              {riskMood}
            </Badge>
          </div>

          <div className="hidden md:flex items-center bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-lg text-[10px] font-mono text-gray-400">
            Session: <span className="text-amber-400 ml-1.5 font-semibold">{topStatus?.marketSession || '--'}</span>
          </div>

          <div className="flex items-center gap-2 select-none">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Last update</div>
              <div className="text-[11px] text-gray-300 font-bold font-mono tracking-wider">{lastUpdated}</div>
            </div>
            <button
              onClick={triggerManualRefresh}
              disabled={isOverviewValidating}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 text-gray-400 hover:text-white transition-all cursor-pointer shadow-sm disabled:opacity-60"
              title="Refresh server-side API routes"
            >
              <RefreshCw className={`w-4 h-4 ${isOverviewValidating ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto bg-slate-950">
        <section className="w-full">
          <MarketOverview data={[...(overview?.indexes ?? []), ...(overview?.macro ?? [])]} />
        </section>

        {overview?.status.sourceStatuses && (
          <section className="w-full">
            <SourceHealthPanel sources={overview.status.sourceStatuses} />
          </section>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 flex flex-col gap-6">
            {summary && <AISummaryCard data={summary} />}
            {overview?.sectors && <SectorHeatmap data={overview.sectors} />}
            {overview?.sectors && <FundFlowWidget data={overview.sectors} />}
          </div>

          <div className="xl:col-span-4 flex flex-col gap-6">
            {risks && <RiskPanel data={risks} />}
            {news && <NewsFeed data={news} />}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800/40 py-3 px-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-gray-600 font-mono uppercase bg-slate-950">
        <div className="flex items-center gap-2 select-none">
          <span>Cloudflare Workers / KV / D1 ready</span>
          <span>|</span>
          <span>API keys stay server-side</span>
        </div>
        <div className="text-center sm:text-right select-none">
          免费数据源可能延迟或限额；页面会显示来源、更新时间、延迟与 stale 状态，不构成投资建议。
        </div>
      </footer>
    </div>
  );
}
