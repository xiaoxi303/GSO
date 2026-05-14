'use client';

import { NewsItem } from '@/lib/types';
import { Card, Badge, SectionTitle } from './Cards';
import { Clock, ExternalLink, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function NewsFeed({ data }: { data: NewsItem[] }) {
  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed border-slate-800">
        <div className="text-sm text-gray-400">暂无新闻数据。未配置 Key 时会优先尝试 GDELT 和 RSS 元数据。</div>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <div className="flex justify-between items-start gap-3 mb-3 pb-2 border-b border-gray-800/50">
        <SectionTitle title="News Metadata" subtitle="仅保存标题、摘要、原始链接、发布时间和来源" />
        <div className="flex gap-1 select-none">
          <Badge variant={data.some(item => item.isStale) ? 'warn' : 'info'} className="text-[9px]">
            {data.some(item => item.isStale) ? 'STALE CACHE' : 'DEDUPED'}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3 max-h-[560px] overflow-y-auto pr-2">
        <AnimatePresence initial={false}>
          {data.map((news) => {
            const isBullish = news.sentiment === 'bullish';
            const isBearish = news.sentiment === 'bearish';
            const borderStyle = isBullish
              ? 'border-l-2 border-l-emerald-500'
              : isBearish
                ? 'border-l-2 border-l-red-500'
                : 'border-l-2 border-l-gray-600';

            return (
              <motion.article
                key={news.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                layout
                className={`p-3.5 rounded-lg border border-gray-800 bg-slate-950/35 flex flex-col gap-2 group hover:border-gray-700 transition-all duration-200 ${borderStyle}`}
              >
                <div className="flex justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-500">
                    <span className="flex items-center gap-1 text-blue-400/80 font-mono">
                      <Clock className="w-3 h-3" />
                      {formatTime(news.publishedAt)}
                    </span>
                    <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-sm font-mono uppercase">{news.source}</span>
                    {news.markets.map(market => (
                      <span key={market} className="px-1 bg-blue-950/50 text-blue-400 rounded-sm border border-blue-900/30">{market}</span>
                    ))}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    {news.isCached && <Badge variant="info" className="text-[9px]">cache</Badge>}
                    {news.isStale && <Badge variant="warn" className="text-[9px]">stale</Badge>}
                  </div>
                </div>

                <a
                  href={news.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-gray-200 leading-snug tracking-wide group-hover:text-white inline-flex gap-1.5"
                >
                  <span>{news.title}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-500" />
                </a>

                {news.rawSummary && (
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    {news.rawSummary}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1 border-t border-gray-800/50 pt-2 text-[11px]">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    metadata only
                  </span>
                  {news.relatedSectors.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {news.relatedSectors.map(sector => (
                        <span key={sector} className="text-emerald-300 bg-emerald-950/30 border border-emerald-900/30 px-1 rounded">{sector}</span>
                      ))}
                    </div>
                  )}
                  {news.relatedSymbols.length > 0 && (
                    <div className="ml-auto flex items-center gap-1 bg-gray-900/50 px-1.5 py-0.5 rounded border border-gray-800">
                      <span className="text-gray-500 font-mono">symbols:</span>
                      <span className="text-gray-300 font-bold font-mono text-[10px]">{news.relatedSymbols.join(', ')}</span>
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}
