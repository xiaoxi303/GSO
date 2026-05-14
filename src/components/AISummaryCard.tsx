'use client';

import { MarketSummary } from '@/lib/types';
import { Card, Badge } from './Cards';
import { BrainCircuit, Lightbulb, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export function AISummaryCard({ data }: { data: MarketSummary }) {
  if (!data) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="h-full relative overflow-hidden border-l-4 border-l-purple-500 bg-slate-900/70">
        <div className="absolute -right-6 -top-6 text-purple-500/5 scale-150">
          <BrainCircuit size={150} />
        </div>

        <div className="flex justify-between items-start gap-3 mb-2 border-b border-gray-800/50 pb-2 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
              <BrainCircuit size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white tracking-wider uppercase">
                智能规则分析 (AISummary)
              </h2>
              <p className="text-[10px] text-gray-500 font-mono">
                服务端基于免费源元数据生成，不依赖前端 API 密钥。
              </p>
            </div>
          </div>
          <Badge variant="info" className="text-[10px]">
            {new Date(data.timestamp).toLocaleTimeString()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 z-10">
          <div className="flex flex-col gap-3">
            <div className="bg-purple-950/10 rounded-lg p-3 border border-purple-500/10">
              <div className="flex items-center gap-1 text-purple-300 text-xs font-bold mb-1.5">
                <Sparkles size={14} /> 核心研判总结
              </div>
              <ul className="space-y-2 text-xs text-gray-300">
                {data.topConclusions.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="mt-1 w-1 h-1 min-w-1 bg-purple-400 rounded-full shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-emerald-950/10 rounded-lg p-3 border border-emerald-500/10">
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold mb-1.5">
                <TrendingUp size={14} /> 强势上涨品种
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.bullishDrivers.length > 0 ? data.bullishDrivers.map((item) => (
                  <Badge key={item} variant="bullish" className="text-[10px]">{item}</Badge>
                )) : <span className="text-xs text-gray-500">暂无数据</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="bg-red-950/10 rounded-lg p-3 border border-red-500/10">
              <div className="flex items-center gap-1 text-red-400 text-xs font-bold mb-1.5">
                <TrendingDown size={14} /> 弱势承压品种
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.bearishDrivers.length > 0 ? data.bearishDrivers.map((item) => (
                  <Badge key={item} variant="bearish" className="text-[10px]">{item}</Badge>
                )) : <span className="text-xs text-gray-500">暂无数据</span>}
              </div>
            </div>

            <div className="bg-blue-950/10 rounded-lg p-3 border border-blue-500/10">
              <div className="flex items-center gap-1 text-blue-400 text-xs font-bold mb-1.5">
                <Lightbulb size={14} /> 前瞻风向提示
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{data.tomorrowOutlook}</p>
            </div>

            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[10px] font-bold text-gray-500 mr-1 uppercase self-center">核心关注焦点:</span>
              {data.mediumTermFocus.map(item => (
                <Badge key={item} variant="neutral" className="text-[10px]">{item}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
