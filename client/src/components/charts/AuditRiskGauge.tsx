import {
  CircularGaugeComponent,
  AxesDirective,
  AxisDirective,
  PointersDirective,
  PointerDirective,
  RangesDirective,
  RangeDirective,
} from '@syncfusion/ej2-react-circulargauge';

interface AuditRiskGaugeProps {
  score: number;
  maxScore: number;
  level: 'low' | 'moderate' | 'elevated' | 'high';
}

const LEVEL_LABELS: Record<string, string> = {
  low: 'Low Risk',
  moderate: 'Moderate',
  elevated: 'Elevated',
  high: 'High Risk',
};

const LEVEL_COLORS: Record<string, string> = {
  low: '#10B981',
  moderate: '#F59E0B',
  elevated: '#F59E0B',
  high: '#EF4444',
};

export default function AuditRiskGauge({ score, maxScore, level }: AuditRiskGaugeProps) {
  // Match the actual risk thresholds from auditRiskService
  const zone1 = 10;  // moderate starts
  const zone2 = 38;  // high starts
  const color = LEVEL_COLORS[level] || '#94A3B8';

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mb-3">
      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Risk Score
      </h4>
      <div className="flex justify-center">
      <CircularGaugeComponent
        height="260px"
        width="500px"
        background="transparent"
      >
        <AxesDirective>
          <AxisDirective
            startAngle={270}
            endAngle={90}
            minimum={0}
            maximum={maxScore}
            lineStyle={{ width: 0 }}
            labelStyle={{ font: { size: '0px' } }}
            majorTicks={{ height: 0 }}
            minorTicks={{ height: 0 }}
          >
            <RangesDirective>
              <RangeDirective start={0} end={zone1} color="#10B981" startWidth={18} endWidth={18} roundedCornerRadius={5} />
              <RangeDirective start={zone1} end={zone2} color="#F59E0B" startWidth={18} endWidth={18} />
              <RangeDirective start={zone2} end={maxScore} color="#EF4444" startWidth={18} endWidth={18} roundedCornerRadius={5} />
            </RangesDirective>
            <PointersDirective>
              <PointerDirective
                value={score}
                type="Needle"
                color="#E2E8F0"
                radius="65%"
                pointerWidth={5}
                needleTail={{ length: '0%' }}
                cap={{ radius: 6, color: '#E2E8F0', border: { width: 0 } }}
              />
            </PointersDirective>
          </AxisDirective>
        </AxesDirective>
      </CircularGaugeComponent>
      </div>
      {/* Score label — plain JSX instead of Syncfusion annotation to avoid CSP eval */}
      <div className="text-center -mt-10">
        <span className="text-xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-slate-500 ml-1">/ {maxScore}</span>
        <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">
          {LEVEL_LABELS[level]}
        </p>
      </div>
    </div>
  );
}
