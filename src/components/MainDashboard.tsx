'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { DashboardOverview, NewsItem, RiskSignal, MarketSummary, QuoteData } from '@/lib/types';
import { MarketOverview } from './MarketOverview';
import { AISummaryCard } from './AISummaryCard';
import { SectorHeatmap } from './SectorHeatmap';
import { NewsFeed } from './NewsFeed';
import { FundFlowWidget } from './FundFlowWidget';
import { RiskPanel } from './RiskPanel';
import { SourceHealthPanel } from './SourceHealthPanel';
import { Badge } from './Cards';
import { Globe, RefreshCw, Radio, ShieldCheck, WifiOff, Search, Loader2, Star } from 'lucide-react';

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

  // Watchlist & Search state
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<QuoteData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Initialize watchlist from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('market_watchlist_v1');
    if (stored) {
      try {
        const symbols = JSON.parse(stored);
        if (Array.isArray(symbols)) {
          setWatchlist(symbols);
        }
      } catch (e) {
        console.error('Failed to load watchlist:', e);
      }
    }
  }, []);

  // Fetch watchlist quotes
  const refreshWatchlist = async (symbols: string[]) => {
    if (symbols.length === 0) {
      setWatchlistQuotes([]);
      return;
    }
    const promises = symbols.map(async (symbol) => {
      try {
        const res = await fetch(`/api/market/quote?symbol=${symbol}`);
        if (!res.ok) return null;
        return (await res.json()) as QuoteData;
      } catch {
        return null;
      }
    });
    const results = await Promise.all(promises);
    setWatchlistQuotes(results.filter((q): q is QuoteData => q !== null));
  };

  // Auto-refresh watchlist when watchlist structure changes
  useEffect(() => {
    refreshWatchlist(watchlist);
  }, [watchlist]);

  // Handle search and add to watchlist
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toUpperCase();
    if (!query) return;

    if (watchlist.includes(query)) {
      setSearchError(`代码 ${query} 已在您的关注列表中`);
      setTimeout(() => setSearchError(null), 4000);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      const res = await fetch(`/api/market/quote?symbol=${query}`);
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data?.error ?? '未找到该标的或获取行情失败');
      }

      // Add successfully
      const nextList = [query, ...watchlist];
      setWatchlist(nextList);
      localStorage.setItem('market_watchlist_v1', JSON.stringify(nextList));
      setSearchQuery('');
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : '查询接口异常，请重试');
      setTimeout(() => setSearchError(null), 5000);
    } finally {
      setSearchLoading(false);
    }
  };

  // Remove from watchlist
  const handleRemoveFromWatchlist = (symbol: string) => {
    const nextList = watchlist.filter((s) => s !== symbol);
    setWatchlist(nextList);
    localStorage.setItem('market_watchlist_v1', JSON.stringify(nextList));
  };

  const topStatus = overview?.status;
  const riskMood = overview?.riskMood || 'Neutral';
  const lastUpdated = topStatus?.lastUpdated ? new Date(topStatus.lastUpdated).toLocaleTimeString() : '--';

  const triggerManualRefresh = async () => {
    await Promise.all([
      mutateOverview(),
      mutateNews(),
      mutateRisks(),
      mutateSummary(),
      refreshWatchlist(watchlist),
    ]);
  };

  // Risk mood label translation
  const translateRiskMood = (mood: string) => {
    if (mood === 'Risk On') return '风险偏好 (On)';
    if (mood === 'Risk Off') return '风险规避 (Off)';
    return '情绪中性';
  };

  // API health translation
  const translateApiHealth = (health: string | undefined) => {
    if (!health) return '加载中...';
    if (health === 'healthy') return '正常';
    if (health === 'offline') return '离线';
    return '降级';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 font-sans flex flex-col">
      <header className="border-b border-slate-800/60 bg-slate-950/90 sticky top-0 z-50 backdrop-blur-lg px-4 sm:px-6 py-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Title & System Status */}
        <div className="flex items-center gap-3 select-none min-w-[280px]">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base md:text-lg font-black tracking-wider uppercase text-gray-100">
                全球市场智能行情
              </h1>
              <Badge variant={topStatus?.apiHealth === 'healthy' ? 'bullish' : topStatus?.apiHealth === 'offline' ? 'bearish' : 'warn'}>
                系统: {translateApiHealth(topStatus?.apiHealth)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 font-mono mt-1">
              <span className="flex items-center gap-1">
                {topStatus?.realtimeConnected ? <ShieldCheck className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-amber-400" />}
                {topStatus?.realtimeConnected ? '实时数据源已连接' : '仅限免费/延时数据源'}
              </span>
              <span className="hidden sm:inline">|</span>
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-blue-400" />
                {topStatus?.dataDelay || '等待数据源'}
              </span>
            </div>
          </div>
        </div>

        {/* Sleek Search Bar Component */}
        <div className="flex flex-col flex-1 max-w-md w-full relative">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 搜索行情代码并加入自选 (例如: NVDA, ASHR, AAPL)"
              className="w-full bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 rounded-xl pl-4 pr-10 py-2 text-xs font-medium text-gray-200 placeholder-gray-500 focus:outline-none transition-all shadow-inner"
              disabled={searchLoading}
            />
            <button
              type="submit"
              disabled={searchLoading || !searchQuery.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
              title="搜索并收藏"
            >
              {searchLoading ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Search className="w-4 h-4" />}
            </button>
          </form>
          {searchError && (
            <div className="absolute top-full mt-1 z-20 text-[10px] text-rose-400 bg-rose-950/90 border border-rose-800/60 px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-lg font-medium animate-in fade-in slide-in-from-top-1">
              <span>⚠️ {searchError}</span>
            </div>
          )}
        </div>

        {/* Right Side Controls & Mood */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold font-mono text-gray-500 uppercase">风险情绪</span>
            <Badge
              variant={riskMood === 'Risk On' ? 'bullish' : riskMood === 'Risk Off' ? 'bearish' : 'neutral'}
              className="py-1 px-3 uppercase font-bold tracking-widest"
            >
              {translateRiskMood(riskMood)}
            </Badge>
          </div>

          <div className="hidden md:flex items-center bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-lg text-[10px] font-mono text-gray-400">
            交易时段: <span className="text-amber-400 ml-1.5 font-semibold">{topStatus?.marketSession || '--'}</span>
          </div>

          <div className="flex items-center gap-2 select-none">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">最后更新</div>
              <div className="text-[11px] text-gray-300 font-bold font-mono tracking-wider">{lastUpdated}</div>
            </div>
            <button
              onClick={triggerManualRefresh}
              disabled={isOverviewValidating}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 text-gray-400 hover:text-white transition-all cursor-pointer shadow-sm disabled:opacity-60"
              title="刷新数据接口"
            >
              <RefreshCw className={`w-4 h-4 ${isOverviewValidating ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto bg-slate-950">
        {/* Watchlist / Custom Symbols Section */}
        {watchlist.length > 0 && (
          <section className="w-full flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center gap-2 select-none">
              <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Star className="w-3.5 h-3.5 fill-current" />
              </div>
              <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                自选/关注标的 (Watchlist)
              </h2>
              <span className="text-[10px] text-gray-500 font-mono">({watchlistQuotes.length})</span>
            </div>
            <MarketOverview data={watchlistQuotes} onRemove={handleRemoveFromWatchlist} />
          </section>
        )}

        {/* Standard Index Overview Section */}
        <section className="w-full flex flex-col gap-2">
          <div className="flex items-center gap-2 select-none">
            <div className="p-1 rounded bg-slate-800 border border-slate-700 text-gray-400">
              <Globe className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              全球核心指数与宏观大类
            </h2>
          </div>
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
          <span>Cloudflare Workers / KV / D1 已就绪</span>
          <span>|</span>
          <span>API 密钥安全存留于服务端</span>
        </div>
        <div className="text-center sm:text-right select-none">
          免费数据源可能存在延迟或请求配额限制；本页仅供分析参考，不构成任何投资理财建议。
        </div>
      </footer>
    </div>
  );
}
