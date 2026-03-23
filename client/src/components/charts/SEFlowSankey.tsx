import { useMemo, useState, useCallback, useRef, useEffect, useId } from 'react';
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  sankeyLeft,
} from 'd3-sankey';

interface ExpenseItem {
  label: string;
  amount: number;
  stepId: string;
}

interface SEFlowSankeyProps {
  grossReceipts: number;
  returnsAndAllowances: number;
  otherBusinessIncome: number;
  cogs: number;
  expenses: ExpenseItem[];
  homeOffice: number;
  vehicle: number;
  depreciation: number;
  netProfit: number;
  seHealthInsurance: number;
  seRetirement: number;
  seTaxDeductibleHalf: number;
  onNodeClick?: (stepId: string) => void;
}

interface SNode {
  id: string;
  label: string;
  value: number;
  colorKey: string;
  stepId?: string;
}

interface SLink {
  source: string;
  target: string;
  value: number;
}

const COLORS: Record<string, string> = {
  income: '#3B82F6',
  cogs: '#F59E0B',
  expense: '#F59E0B',
  homeOffice: '#A78BFA',
  vehicle: '#818CF8',
  depreciation: '#6366F1',
  intermediate: '#94A3B8',
  seDeduction: '#10B981',
  result: '#94A3B8',
};

function fmtDollars(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}

function buildData(p: SEFlowSankeyProps): { nodes: SNode[]; links: SLink[] } {
  const nodes: SNode[] = [];
  const links: SLink[] = [];

  // Source: Gross Receipts
  nodes.push({ id: 'gross', label: 'Gross Receipts', value: p.grossReceipts, colorKey: 'income', stepId: 'income_summary' });

  // Other income additions
  if (p.otherBusinessIncome > 0) {
    nodes.push({ id: 'otherIncome', label: 'Other Income', value: p.otherBusinessIncome, colorKey: 'income', stepId: 'business_info' });
  }

  // Total income flowing into the system
  const totalInflow = p.grossReceipts + p.otherBusinessIncome;

  // Returns & Allowances (sink)
  if (p.returnsAndAllowances > 0) {
    nodes.push({ id: 'returns', label: 'Returns & Allowances', value: p.returnsAndAllowances, colorKey: 'cogs', stepId: 'business_info' });
  }

  // COGS (sink)
  if (p.cogs > 0) {
    nodes.push({ id: 'cogs', label: 'Cost of Goods Sold', value: p.cogs, colorKey: 'cogs', stepId: 'cost_of_goods_sold' });
  }

  // Individual expense items (sinks)
  const expenseItems = p.expenses.filter(e => e.amount > 0);
  for (const exp of expenseItems) {
    const id = `exp_${exp.label.replace(/\s+/g, '_').toLowerCase()}`;
    nodes.push({ id, label: exp.label, value: exp.amount, colorKey: 'expense', stepId: exp.stepId });
  }

  // Home office, vehicle, depreciation (sinks — separate from expenses)
  if (p.homeOffice > 0) {
    nodes.push({ id: 'homeOffice', label: 'Home Office', value: p.homeOffice, colorKey: 'homeOffice', stepId: 'home_office' });
  }
  if (p.vehicle > 0) {
    nodes.push({ id: 'vehicle', label: 'Vehicle', value: p.vehicle, colorKey: 'vehicle', stepId: 'vehicle_expenses' });
  }
  if (p.depreciation > 0) {
    nodes.push({ id: 'depreciation', label: 'Depreciation', value: p.depreciation, colorKey: 'depreciation', stepId: 'depreciation_assets' });
  }

  // Net Profit (intermediate)
  const absNetProfit = Math.max(1, Math.abs(p.netProfit));
  nodes.push({ id: 'netProfit', label: p.netProfit >= 0 ? 'Net Profit' : 'Net Loss', value: absNetProfit, colorKey: 'intermediate', stepId: 'se_summary' });

  // SE deductions
  const hasSEDed = p.seHealthInsurance > 0 || p.seRetirement > 0 || p.seTaxDeductibleHalf > 0;
  if (hasSEDed && p.netProfit > 0) {
    if (p.seHealthInsurance > 0) {
      nodes.push({ id: 'seHealth', label: 'SE Health Insurance', value: p.seHealthInsurance, colorKey: 'seDeduction', stepId: 'se_health_insurance' });
    }
    if (p.seRetirement > 0) {
      nodes.push({ id: 'seRetirement', label: 'SE Retirement', value: p.seRetirement, colorKey: 'seDeduction', stepId: 'se_retirement' });
    }
    if (p.seTaxDeductibleHalf > 0) {
      nodes.push({ id: 'seTaxDed', label: 'SE Tax Deduction', value: p.seTaxDeductibleHalf, colorKey: 'seDeduction', stepId: 'se_retirement' });
    }
    const taxable = Math.max(1, p.netProfit - p.seHealthInsurance - p.seRetirement - p.seTaxDeductibleHalf);
    nodes.push({ id: 'taxableSE', label: 'Taxable SE Income', value: taxable, colorKey: 'result', stepId: 'se_summary' });
  }

  // --- Build links ---
  // All deductions flow proportionally from gross receipts (and other income)
  const totalDeductions = p.returnsAndAllowances + p.cogs
    + expenseItems.reduce((s, e) => s + e.amount, 0)
    + p.homeOffice + p.vehicle + p.depreciation;

  // All sinks that come out of income
  const sinkNodes: { id: string; value: number }[] = [];
  if (p.returnsAndAllowances > 0) sinkNodes.push({ id: 'returns', value: p.returnsAndAllowances });
  if (p.cogs > 0) sinkNodes.push({ id: 'cogs', value: p.cogs });
  for (const exp of expenseItems) {
    const id = `exp_${exp.label.replace(/\s+/g, '_').toLowerCase()}`;
    sinkNodes.push({ id, value: exp.amount });
  }
  if (p.homeOffice > 0) sinkNodes.push({ id: 'homeOffice', value: p.homeOffice });
  if (p.vehicle > 0) sinkNodes.push({ id: 'vehicle', value: p.vehicle });
  if (p.depreciation > 0) sinkNodes.push({ id: 'depreciation', value: p.depreciation });

  // From Gross Receipts: proportional outflow to each sink + net profit
  const grossPortion = p.grossReceipts / totalInflow;
  for (const sink of sinkNodes) {
    links.push({ source: 'gross', target: sink.id, value: Math.max(1, sink.value * grossPortion) });
  }
  const netProfitFromGross = Math.max(1, (totalInflow - totalDeductions) * grossPortion);
  links.push({ source: 'gross', target: 'netProfit', value: netProfitFromGross });

  // From Other Income: proportional outflow
  if (p.otherBusinessIncome > 0) {
    const otherPortion = p.otherBusinessIncome / totalInflow;
    for (const sink of sinkNodes) {
      links.push({ source: 'otherIncome', target: sink.id, value: Math.max(1, sink.value * otherPortion) });
    }
    const netProfitFromOther = Math.max(1, (totalInflow - totalDeductions) * otherPortion);
    links.push({ source: 'otherIncome', target: 'netProfit', value: netProfitFromOther });
  }

  // SE deduction links from Net Profit
  if (hasSEDed && p.netProfit > 0) {
    if (p.seHealthInsurance > 0) links.push({ source: 'netProfit', target: 'seHealth', value: p.seHealthInsurance });
    if (p.seRetirement > 0) links.push({ source: 'netProfit', target: 'seRetirement', value: p.seRetirement });
    if (p.seTaxDeductibleHalf > 0) links.push({ source: 'netProfit', target: 'seTaxDed', value: p.seTaxDeductibleHalf });
    const taxable = Math.max(1, p.netProfit - p.seHealthInsurance - p.seRetirement - p.seTaxDeductibleHalf);
    links.push({ source: 'netProfit', target: 'taxableSE', value: taxable });
  }

  return { nodes, links };
}

export default function SEFlowSankey(props: SEFlowSankeyProps) {
  const { onNodeClick } = props;
  const gradientId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const data = useMemo(() => buildData(props), [
    props.grossReceipts, props.returnsAndAllowances, props.otherBusinessIncome,
    props.cogs, props.expenses, props.homeOffice, props.vehicle, props.depreciation,
    props.netProfit, props.seHealthInsurance, props.seRetirement, props.seTaxDeductibleHalf,
  ]);

  const height = Math.max(280, data.nodes.length * 36);

  const layout = useMemo(() => {
    if (width < 100) return null;

    const margin = { top: 16, right: 160, bottom: 16, left: 16 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const nodeMap = new Map(data.nodes.map((n, i) => [n.id, i]));
    const sankeyNodes = data.nodes.map((n, i) => ({ ...n, nodeId: i }));
    const sankeyLinks = data.links
      .filter(l => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map(l => ({
        source: nodeMap.get(l.source)!,
        target: nodeMap.get(l.target)!,
        value: Math.max(1, l.value),
      }));

    const gen = d3Sankey<SNode, SLink>()
      .nodeId((d: any) => d.nodeId)
      .nodeAlign(sankeyLeft)
      .nodeWidth(12)
      .nodePadding(8)
      .extent([[margin.left, margin.top], [margin.left + innerWidth, margin.top + innerHeight]]);

    try {
      return gen({
        nodes: sankeyNodes.map(d => ({ ...d })),
        links: sankeyLinks.map(d => ({ ...d })),
      } as any);
    } catch {
      return null;
    }
  }, [data, width, height]);

  const linkPath = useMemo(() => sankeyLinkHorizontal(), []);

  const handleNodeClick = useCallback((node: any) => {
    if (node.stepId && onNodeClick) onNodeClick(node.stepId);
  }, [onNodeClick]);

  const handleNodeHover = useCallback((e: React.MouseEvent, node: any, entering: boolean) => {
    if (!entering) { setTooltip(null); return; }
    const rect = (e.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 12,
        text: `${node.label}: ${fmtDollars(node.value)}`,
      });
    }
  }, []);

  const handleLinkHover = useCallback((e: React.MouseEvent, link: any, entering: boolean) => {
    if (!entering) { setHoveredLink(null); setTooltip(null); return; }
    const source = link.source;
    const target = link.target;
    setHoveredLink(`${source.id}-${target.id}`);
    const rect = (e.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 12,
        text: `${source.label} → ${target.label}: ${fmtDollars(link.value)}`,
      });
    }
  }, []);

  if (!layout) return <div ref={ref} className="w-full min-h-[280px]" />;

  const nodes = (layout.nodes || []) as any[];
  const links = (layout.links || []) as any[];

  return (
    <div ref={ref} className="w-full relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`SE flow: ${fmtDollars(props.grossReceipts)} gross receipts to ${fmtDollars(props.netProfit)} net profit`}
      >
        <defs>
          {links.map((link: any, i: number) => {
            const sColor = COLORS[link.source.colorKey] || '#64748B';
            const tColor = COLORS[link.target.colorKey] || '#64748B';
            return (
              <linearGradient
                key={i}
                id={`${gradientId}-link-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={link.source.x1}
                x2={link.target.x0}
              >
                <stop offset="0%" stopColor={sColor} />
                <stop offset="100%" stopColor={tColor} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Links */}
        <g fill="none">
          {links.map((link: any, i: number) => {
            const linkId = `${link.source.id}-${link.target.id}`;
            const isHovered = hoveredLink === linkId;
            const pathD = linkPath(link as any);
            if (!pathD) return null;
            return (
              <path
                key={i}
                d={pathD}
                stroke={`url(#${gradientId}-link-${i})`}
                strokeWidth={Math.max(1, link.width || 1)}
                strokeOpacity={isHovered ? 0.6 : 0.3}
                style={{ transition: 'stroke-opacity 150ms' }}
                onMouseEnter={(e) => handleLinkHover(e, link, true)}
                onMouseLeave={(e) => handleLinkHover(e, link, false)}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map((node: any) => {
            const nw = (node.x1 ?? 0) - (node.x0 ?? 0);
            const nh = (node.y1 ?? 0) - (node.y0 ?? 0);
            const color = COLORS[node.colorKey] || '#64748B';
            return (
              <g
                key={node.id}
                style={{ cursor: node.stepId ? 'pointer' : 'default' }}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={(e) => handleNodeHover(e, node, true)}
                onMouseLeave={(e) => handleNodeHover(e, node, false)}
              >
                <rect
                  x={node.x0}
                  y={node.y0}
                  width={nw}
                  height={Math.max(nh, 2)}
                  rx={3}
                  ry={3}
                  fill={color}
                  fillOpacity={0.9}
                />
                <text
                  x={(node.x1 ?? 0) + 6}
                  y={(node.y0 ?? 0) + nh / 2}
                  dy="0.35em"
                  textAnchor="start"
                  fill="#CBD5E1"
                  fontSize={11}
                  fontFamily="Inter Variable, sans-serif"
                  fontWeight={node.colorKey === 'intermediate' || node.colorKey === 'result' ? 600 : 400}
                >
                  {node.label}
                  <tspan dx={5} fill="#94A3B8" fontSize={10}>
                    {fmtDollars(node.value)}
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-lg text-xs whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#1E293B',
            border: '1px solid #475569',
            color: '#E2E8F0',
            fontFamily: 'Inter Variable, sans-serif',
            zIndex: 10,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
