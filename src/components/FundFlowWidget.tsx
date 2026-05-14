'use client';

import { SectorFundFlow } from '@/lib/types';
import { Card, Badge, SectionTitle } from './Cards';

export function FundFlowWidget({ data }: { data: SectorFundFlow[] }) {
  if (!data || data.length === 0) return null;

  const sorted = [...data].sort((a, b) => b.changePercent - a.changePercent);
  const leaders = sorted.slice(0, 6);
  const laggards = [...sorted].reverse().slice(0, 6);
  const hasActualFlow = data.some(item => item.dataQuality === 'actual' && item.netInflow !== 0);

  return (
    <Card className="h-full">
      <div className="flex justify-between items-start gap-3 mb-3 border-b border-gray-800/50 pb-2">
        <SectionTitle
          title="板块强弱与资金监控"
          subtitle={hasActualFlow ? '真实资金流与价格表现' : '当前未配置可核验资金流源，仅展示 ETF 价格代理'}
        />
        <Badge variant={hasActualFlow ? 'bullish' : 'warn'} className="text-[9px]">
          {hasActualFlow ? '真实资金流' : '无资金流订阅'}
        </Badge>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mt-2">
        {renderList(leaders, '最强价格代理')}
        <div className="hidden lg:block w-px bg-gray-800 self-stretch" />
        {renderList(laggards, '最弱价格代理')}
      </div>
    </Card>
  );
}

function renderList(items: SectorFundFlow[], title: string) {
  return (
    <div className="flex flex-col gap-2.5 flex-1">
      <h3 className="text-xs font-bold pb-1.5 border-b border-gray-800 flex justify-between items-center text-gray-300">
        <span>{title}</span>
        <span className="text-[10px] font-normal text-gray-500 font-mono">价格代理</span>
      </h3>
      <div className="flex flex-col gap-2 mt-1">
        {items.map((item, index) => {
          const pctWidth = Math.min(100, Math.abs(item.changePercent) * 18);
          const isUp = item.changePercent >= 0;

          return (
            <div key={`${title}-${item.sector}`} className="flex flex-col relative group select-none">
              <div className="flex justify-between items-center gap-2 z-10">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-4 text-xs font-bold text-gray-600 text-center font-mono">#{index + 1}</span>
                  <span className="text-xs font-semibold text-gray-200 truncate">{item.sector}</span>
                  <span className="text-[9px] px-1 rounded bg-gray-800 text-gray-400 font-mono border border-gray-700/50">{item.market}</span>
                </div>
                <span className={`text-xs font-bold font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isUp ? '+' : ''}{item.changePercent.toFixed(2)}%
                </span>
              </div>

              <div className="h-1 bg-gray-800/50 rounded-full mt-1.5 overflow-hidden w-full relative">
                <div
                  style={{ width: `${pctWidth}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${isUp ? 'bg-emerald-500/45' : 'bg-red-500/45'}`}
                />
              </div>

              <div className="flex justify-between mt-1 gap-2">
                <span className="text-[9px] text-gray-500 truncate max-w-[65%]">
                  {item.representativeStocks.join('/')} · {item.source ?? '等待加载'}
                </span>
                <span className="text-[9px] text-gray-500 text-right font-mono">
                  资金流向: {item.netInflow === 0 ? '暂无数据' : formatMoney(item.netInflow)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value / 100_000_000).toFixed(2)}亿`;
}
