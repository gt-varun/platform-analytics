import React from 'react';
import { InsightItem } from '../types/analytics';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface InsightPanelProps {
  insights: InsightItem[];
}

export const InsightPanel: React.FC<InsightPanelProps> = ({ insights }) => {
  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center">
            <Lightbulb className="w-4 h-4 mr-2 text-amber-400" />
            Executive Business Summary
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated insights computed 100% deterministically from endpoint payload
          </p>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
          {insights.length} Insights Derived
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((item) => {
          let icon = <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
          let borderStyle = 'border-slate-800/80 hover:border-slate-700';

          if (item.impact === 'attention') {
            icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
            borderStyle = 'border-amber-500/30 bg-amber-950/10 hover:border-amber-500/50';
          } else if (item.impact === 'positive') {
            icon = <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
            borderStyle = 'border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/40';
          }

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border bg-slate-950/60 transition-all duration-150 flex items-start space-x-3 ${borderStyle}`}
            >
              {icon}
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {item.category}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 leading-snug">{item.title}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
