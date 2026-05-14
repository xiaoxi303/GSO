'use client';

import { SectorFundFlow } from '@/lib/types';
import { Card, SectionTitle, Badge } from './Cards';

export function SectorHeatmap({ data }: { data: SectorFundFlow[] }) {
  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed border-slate-800">
        <div className="text-sm text-gray-400">暂无板块数据。未配置真实源时不会生成模拟资金流。</div>
      </Card>
    );
  }

  const cnData = data.filter(item => item.market === 'CN' || item.market === 'HK');
  const usData = data.filter(item => item.market === 'US');

  return (
    <Card className="h-full">
      <div className="flex justify-between items-start gap-3 mb-2 border-b border-gray-800/50 pb-2">
        <SectionTitle title="Sector Proxy Heatmap" subtitle="板块 ETF 价格代理；不伪造主力资金流" />
        <Badge variant="warn" className="text-[9px]">proxy data</Badge>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 mt-1">
        {renderGrid(cnData, 'China / Hong Kong proxies')}
        {renderGrid(usData, 'US sector ETFs')}
      </div>
    </Card>
  );
}

function renderGrid(items: SectorFundFlow[], title: string) {
  return (
    <div className="flex flex-col gap-2 flex-1">
      <h3 className="text-xs font-semibold text-gray-400 border-b border-gray-800 pb-1 mb-1 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        {title} ({items.length})
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 select-none">
        {items.map((item) => {
          const pct = item.changePercent;
          let bgStyle = 'bg-gray-800/30 text-gray-400 border border-gray-800';
          if (pct >= 2.5) bgStyle = 'bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold';
          else if (pct > 0.8) bgStyle = 'bg-emerald-900/40 border border-emerald-800/50 text-emerald-400';
          else if (pct > 0) bgStyle = 'bg-emerald-900/20 border border-emerald-900/30 text-emerald-400/80';
          else if (pct <= -2.5) bgStyle = 'bg-red-950 border border-red-500/40 text-red-300 font-bold';
          else if (pct < -0.8) bgStyle = 'bg-red-900/40 border border-red-800/50 text-red-400';
          else if (pct < 0) bgStyle = 'bg-red-900/20 border border-red-900/30 text-red-400/80';

          return (
            <div
              key={`${item.market}-${item.sector}`}
              className={`p-3 rounded-lg text-center flex flex-col items-center justify-center min-h-24 hover:scale-[1.02] active:scale-95 transition-all relative overflow-hidden ${bgStyle}`}
              title={item.notice}
            >
              <span className="text-xs tracking-wide font-medium leading-tight truncate max-w-full px-1">{item.sector}</span>
              <span className="text-sm font-bold font-mono mt-0.5">{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</span>
              <span className="text-[9px] opacity-70 font-mono mt-1 whitespace-nowrap max-w-full truncate">
                {item.representativeStocks.join('/')} · {item.source ?? 'source pending'}
              </span>
              {item.isStale && <span className="text-[9px] mt-1 text-amber-300">stale cache</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
