import { useMemo, useState, useCallback, useRef, useEffect, useId } from 'react';
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  sankeyLeft,
} from 'd3-sankey';

interface BarItem {
  label: string;
  amount: number;
  stepId: string;
}

interface DeductionsFlowSankeyProps {
  totalIncome: number;
  adjustments: BarItem[];
  deductions: BarItem[];
  isItemized: boolean;
  agi: number;
  deductionAmount: number;
  deductionLabel: string;
  qbiDeduction: number;
  taxableIncome: number;
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
  adjustment: '#F59E0B',
  intermediate: '#94A3B8',
  deduction: '#14B8A6',
  qbi: '#06B6D4',
  result: '#94A3B8',
};

function fmtDollars(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}

function buildData(p: DeductionsFlowSankeyProps): { nodes: SNode[]; links: SLink[] } {
  const nodes: SNode[] = [];
  const links: SLink[] = [];

  // Source: Total Income
  nodes.push({ id: 'totalIncome', label: 'Total Income', value: p.totalIncome, colorKey: 'income', stepId: 'income_overview' });

  const hasAdj = p.adjustments.length > 0;

  // Individual adjustment nodes
  if (hasAdj) {
    for (const adj of p.adjustments) {
      const id = `adj_${adj.label.replace(/\s+/g, '_').toLowerCase()}`;
      nodes.push({ id, label: adj.label, value: adj.amount, colorKey: 'adjustment', stepId: adj.stepId });
      links.push({ source: 'totalIncome', target: id, value: adj.amount });
    }

    // AGI intermediate node
    nodes.push({ id: 'agi', label: 'AGI', value: p.agi, colorKey: 'intermediate', stepId: 'deductions_summary' });
    links.push({ source: 'totalIncome', target: 'agi', value: Math.max(1, p.agi) });
  }

  const branchFrom = hasAdj ? 'agi' : 'totalIncome';

  // Deduction nodes — itemized shows individual items, standard shows one bar
  if (p.isItemized && p.deductions.length > 0) {
    for (const ded of p.deductions) {
      const id = `ded_${ded.label.replace(/\s+/g, '_').toLowerCase()}`;
      nodes.push({ id, label: ded.label, value: ded.amount, colorKey: 'deduction', stepId: ded.stepId });
      links.push({ source: branchFrom, target: id, value: ded.amount });
    }
  } else if (p.deductionAmount > 0) {
    nodes.push({ id: 'deductions', label: p.deductionLabel, value: p.deductionAmount, colorKey: 'deduction', stepId: 'deduction_method' });
    links.push({ source: branchFrom, target: 'deductions', value: p.deductionAmount });
  }

  // QBI Deduction
  if (p.qbiDeduction > 0) {
    nodes.push({ id: 'qbi', label: 'QBI Deduction', value: p.qbiDeduction, colorKey: 'qbi', stepId: 'qbi_detail' });
    links.push({ source: branchFrom, target: 'qbi', value: p.qbiDeduction });
  }

  // Taxable Income result
  nodes.push({ id: 'taxableIncome', label: 'Taxable Income', value: Math.max(1, p.taxableIncome), colorKey: 'result', stepId: 'deductions_summary' });
  links.push({ source: branchFrom, target: 'taxableIncome', value: Math.max(1, p.taxableIncome) });

  return { nodes, links };
}

export default function DeductionsFlowSankey(props: DeductionsFlowSankeyProps) {
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
    props.totalIncome, props.adjustments, props.deductions, props.isItemized,
    props.agi, props.deductionAmount, props.deductionLabel, props.qbiDeduction, props.taxableIncome,
  ]);

  const height = Math.max(280, data.nodes.length * 40);

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
        aria-label={`Deductions flow: ${fmtDollars(props.totalIncome)} total income to ${fmtDollars(props.taxableIncome)} taxable income`}
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
