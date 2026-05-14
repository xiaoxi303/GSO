'use client';

import { RiskSignal } from '@/lib/types';
import { Card, Badge, SectionTitle } from './Cards';
import { ShieldCheck, Siren, Zap } from 'lucide-react';

export function RiskPanel({ data }: { data: RiskSignal[] }) {
  if (!data || data.length === 0) {
    return (
      <Card className="h-full items-center justify-center border-dashed border-emerald-900/40 bg-emerald-950/5">
        <div className="text-emerald-500 flex items-center gap-2 text-xs font-bold">
          <ShieldCheck size={14} />
          未从真实免费数据源中检测到可量化风险信号。
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full relative overflow-hidden border border-red-950/50 bg-red-950/5">
      <div className="absolute -right-4 -bottom-4 text-red-500/5">
        <Zap size={120} />
      </div>

      <div className="flex justify-between items-start gap-3 mb-3 border-b border-red-950/50 pb-2 z-10">
        <SectionTitle title="Risk Signals" subtitle="由已返回的真实行情/宏观数据规则触发" />
        <span className="text-[10px] font-bold text-red-400 font-mono uppercase">MONITORING</span>
      </div>

      <div className="flex flex-col gap-3 mt-1 z-10">
        {data.map((risk) => {
          const isHigh = risk.riskLevel === 'high' || risk.riskLevel === 'extreme';

          return (
            <div
              key={risk.id}
              className={`p-3 rounded-lg border flex flex-col gap-1.5 relative ${
                isHigh
                  ? 'bg-red-950/30 border-red-700/50 glow-red'
                  : 'bg-slate-900/60 border-red-900/30'
              }`}
            >
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Siren className={`w-4 h-4 shrink-0 ${isHigh ? 'text-red-400 animate-pulse' : 'text-red-500/80'}`} />
                  <span className="text-xs font-extrabold text-red-400 uppercase tracking-wider truncate">{risk.riskType}</span>
                </div>
                <Badge variant={risk.riskLevel === 'medium' ? 'warn' : 'extreme'} className="text-[9px] font-mono">
                  {risk.riskLevel.toUpperCase()}
                </Badge>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">{risk.reason}</p>

              <div className="flex flex-wrap gap-2 border-t border-red-950/30 pt-2 mt-1 text-[10px]">
                <div className="flex gap-1 font-mono">
                  <span className="text-red-500/80">markets:</span>
                  <span className="text-gray-400 font-bold">{risk.affectedMarkets.join(', ')}</span>
                </div>
                <div className="flex gap-1 font-mono">
                  <span className="text-red-500/80">sectors:</span>
                  <span className="text-gray-400 font-bold">{risk.affectedSectors.join(', ')}</span>
                </div>
                {risk.safeHavens && (
                  <div className="ml-auto flex gap-1 font-mono bg-emerald-950/20 px-1 rounded border border-emerald-900/20">
                    <span className="text-emerald-400">hedge:</span>
                    <span className="text-emerald-300 font-bold">{risk.safeHavens.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
