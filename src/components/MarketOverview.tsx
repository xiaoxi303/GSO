'use client';

import { QuoteData } from '@/lib/types';
import { X } from 'lucide-react';
import { Card, PriceTag, Badge } from './Cards';

export function MarketOverview({ data, onRemove }: { data: QuoteData[]; onRemove?: (symbol: string) => void }) {
  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed border-slate-800">
        <div className="text-sm text-gray-400">暂无行情数据。请在上方搜索框搜索代码添加，或配置服务端 API Key。</div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-3 select-none">
      {data.map((item) => {
        const isUp = item.changePercent > 0;
        const isZero = item.changePercent === 0;

        return (
          <Card
            key={`${item.symbol}-${item.source}`}
            className={`hover:scale-[1.01] transform transition-all relative overflow-hidden group bg-slate-900/45 ${
              isUp ? 'hover:border-emerald-500/30' : isZero ? '' : 'hover:border-red-500/30'
            }`}
          >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 ${isUp ? 'bg-emerald-500' : 'bg-red-500'}`} />

            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.symbol);
                }}
                title="移除自选"
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-slate-950/60 border border-slate-800/50 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-20 hover:scale-105"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}

            <div className="flex justify-between items-start gap-2 z-10">
              <div className="flex flex-col gap-0.5 min-w-0 pr-3">
                <span className="text-[10px] text-gray-500 font-semibold flex items-center gap-1 uppercase">
                  <span className={`w-1.5 h-1.5 rounded-full ${marketDot(item.market)}`} />
                  {item.market} · {translateAssetType(item.assetType)}
                </span>
                <span className="text-xs font-bold text-gray-200 tracking-tight truncate max-w-[120px]">
                  {item.name}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">{item.symbol}</span>
              </div>
              <PriceTag val={item.price} pct={item.changePercent} isMacro={item.symbol === 'US10Y' || item.symbol === 'FEDFUNDS'} />
            </div>

            <div className="z-10 flex flex-wrap items-center gap-1 pt-1">
              <Badge variant={item.isStale ? 'warn' : item.isDelayed ? 'neutral' : 'bullish'} className="text-[9px]">
                {item.isStale ? '过期缓存' : item.isDelayed ? '延时' : '实时'}
              </Badge>
              {item.isCached && <Badge variant="info" className="text-[9px]">缓存</Badge>}
            </div>

            <div className="z-10 text-[10px] leading-relaxed text-gray-500">
              <div>数据源: <span className="text-gray-300">{item.source}</span></div>
              <div>更新于: <span className="font-mono">{new Date(item.timestamp).toLocaleTimeString()}</span></div>
              {item.notice && <div className="line-clamp-2 text-amber-300/80">{item.notice}</div>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function translateAssetType(type: string) {
  const map: Record<string, string> = {
    etf: 'ETF',
    stock: '股票',
    commodity: '大宗商品',
    crypto: '加密货币',
    forex: '外汇',
    index: '指数',
  };
  return map[type.toLowerCase()] || type;
}

function marketDot(market: QuoteData['market']) {
  if (market === 'US') return 'bg-blue-500';
  if (market === 'CN') return 'bg-red-500';
  if (market === 'HK') return 'bg-orange-500';
  if (market === 'EU') return 'bg-indigo-500';
  if (market === 'AS') return 'bg-purple-500';
  return 'bg-emerald-500';
}
