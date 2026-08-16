import React from 'react';
import { InsightItem } from '../types/analytics';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, SectionHeading } from './ui';

interface InsightPanelProps {
  insights: InsightItem[];
}

export const InsightPanel: React.FC<InsightPanelProps> = ({ insights }) => (
  <Card>
    <SectionHeading
      title="What the numbers say"
      subtitle="Derived from the endpoint payload — no judgement calls, no manual input."
      icon={<Lightbulb className="w-[18px] h-[18px]" />}
      actions={
        <span className="num text-[11px] px-2 py-1 rounded-md bg-sunken text-muted border border-line font-medium">
          {insights.length} findings
        </span>
      }
    />

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {insights.map((item) => {
        let icon = <CheckCircle className="w-4 h-4 text-positive shrink-0 mt-0.5" />;
        if (item.impact === 'attention') {
          icon = <AlertTriangle className="w-4 h-4 text-caution shrink-0 mt-0.5" />;
        } else if (item.impact === 'positive') {
          icon = <TrendingUp className="w-4 h-4 text-positive shrink-0 mt-0.5" />;
        }

        return (
          <div
            key={item.id}
            className="p-4 rounded-lg border border-line bg-sunken flex items-start gap-3 hover:border-line-strong transition-colors"
          >
            {icon}
            <div className="min-w-0">
              <span className="label text-[10px]">{item.category}</span>
              <h4 className="text-[13px] font-semibold text-ink leading-snug mt-1">{item.title}</h4>
              <p className="text-[12px] text-muted mt-1 leading-relaxed">{item.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  </Card>
);
